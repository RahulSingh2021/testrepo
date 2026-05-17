"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MessageCircle, X } from 'lucide-react';
import WhatsAppInbox from './WhatsAppInbox';

const AUTH_KEY = 'haccp_auth';
const ADMIN_TOKEN_KEY = 'admin_session_token';
const ENTITY_KEY = 'haccp_entityId';
const SUPER_ADMIN_SCOPE = 'super-admin';
const LAST_SEEN_INBOUND_KEY = 'wa_inbox_last_seen_inbound';
const SOUND_MUTED_KEY = 'wa_inbox_sound_muted';

// The floating WhatsApp icon is reserved for the super-admin who is
// viewing the platform from the top — i.e. NOT impersonating a child
// node. Three things must all hold:
//
//   1. The auth scope is `super-admin`. Direct logins as
//      corporate/regional/unit accounts have a different scope value
//      and are filtered out here.
//
//   2. An admin session token has been minted (without it, the inbox
//      and media APIs would 401 anyway).
//
//   3. No entity impersonation is active (`haccp_entityId` is empty).
//      When the super-admin clicks "Act as <unit>" the header chip
//      flips to "ACTING AS UNIT" and `haccp_entityId` is set; in that
//      mode the user is effectively operating as a unit-level user
//      and the WhatsApp inbox should NOT be visible.
function readIsAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed?.scope !== SUPER_ADMIN_SCOPE) return false;
    const token = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (typeof token !== 'string' || token.length === 0) return false;
    const actingEntityId = window.localStorage.getItem(ENTITY_KEY);
    if (actingEntityId && actingEntityId.length > 0) return false;
    return true;
  } catch {
    return false;
  }
}

function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

// Lightweight WebAudio "ding" — no asset file required, plays on any
// modern browser. Two-tone pleasant chime.
function playDing() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const tones = [
      { f: 880, t: now,        d: 0.18 },
      { f: 1320, t: now + 0.16, d: 0.22 },
    ];
    tones.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + d + 0.05);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 1000);
  } catch {}
}

const WhatsAppInboxFloating: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SOUND_MUTED_KEY) === '1';
  });
  const lastSeenRef = useRef<string | null>(null);
  // Browsers block audio until the user has interacted with the page;
  // we track whether we've had any user gesture so we only attempt to
  // play after that.
  const userInteractedRef = useRef<boolean>(false);

  useEffect(() => {
    setIsAdmin(readIsAdmin());
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_KEY || e.key === ADMIN_TOKEN_KEY || e.key === ENTITY_KEY || e.key === null) setIsAdmin(readIsAdmin());
    };
    const onVisibility = () => { if (!document.hidden) setIsAdmin(readIsAdmin()); };
    const onInteract = () => { userInteractedRef.current = true; };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('click', onInteract, { once: false });
    window.addEventListener('keydown', onInteract, { once: false });
    const id = window.setInterval(() => setIsAdmin(readIsAdmin()), 4000);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('click', onInteract);
      window.removeEventListener('keydown', onInteract);
      window.clearInterval(id);
    };
  }, []);

  // Poll unread count every 8s while admin and inbox is closed.
  // While the inbox is open the inner WhatsAppInbox component handles
  // its own polling and read-marking.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    lastSeenRef.current = window.localStorage.getItem(LAST_SEEN_INBOUND_KEY);

    const tick = async () => {
      try {
        const res = await fetch('/api/whatsapp/inbox?action=unread-count', {
          headers: { 'x-admin-token': getAdminToken() },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const count = Number(data.unread || 0);
        const lastIn: string | null = data.lastInbound || null;
        setUnread(count);
        // Fire chime when a brand-new inbound message arrives (lastInbound
        // timestamp moved forward), only if not muted, only after user
        // interaction, and only when the inbox is closed.
        if (
          lastIn
          && lastSeenRef.current
          && lastIn > lastSeenRef.current
          && !muted
          && !open
          && userInteractedRef.current
        ) {
          playDing();
        }
        if (lastIn && lastIn !== lastSeenRef.current) {
          lastSeenRef.current = lastIn;
          try { window.localStorage.setItem(LAST_SEEN_INBOUND_KEY, lastIn); } catch {}
        }
      } catch {}
    };

    tick();
    const id = window.setInterval(tick, 8000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [isAdmin, muted, open]);

  // When the inbox is opened, treat the current latest inbound as "seen"
  // so we don't ding for a message the admin is now actively viewing.
  useEffect(() => {
    if (open && lastSeenRef.current) {
      try { window.localStorage.setItem(LAST_SEEN_INBOUND_KEY, lastSeenRef.current); } catch {}
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!isAdmin && open) setOpen(false);
  }, [isAdmin, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { window.localStorage.setItem(SOUND_MUTED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  if (!isAdmin) return null;

  return (
    <>
      {!open && (
        <div className="fixed bottom-6 right-6 z-[10040] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? 'Unmute notification sound' : 'Mute notification sound'}
            title={muted ? 'Sound is muted — click to unmute' : 'Sound is on — click to mute'}
            className={`h-8 w-8 rounded-full ${muted ? 'bg-slate-200 text-slate-500' : 'bg-white text-emerald-700'} shadow ring-1 ring-slate-300 hover:scale-105 transition-all flex items-center justify-center text-[13px] font-bold`}
          >
            {muted ? '🔕' : '🔔'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Open WhatsApp inbox${unread > 0 ? `, ${unread} unread` : ''}`}
            title={unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'WhatsApp Inbox'}
            className="relative h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#1ebe57] active:scale-95 text-white shadow-2xl shadow-emerald-900/30 ring-4 ring-white/70 flex items-center justify-center transition-all"
          >
            <MessageCircle size={26} strokeWidth={2.4} />
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-[11px] font-black flex items-center justify-center ring-2 ring-white animate-pulse"
                aria-hidden
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[10050] bg-slate-900/60 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                <MessageCircle size={18} strokeWidth={2.6} />
              </div>
              <div>
                <div className="text-sm font-black text-slate-800 leading-tight">WhatsApp Inbox</div>
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Super Admin</div>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close WhatsApp inbox"
              className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white overflow-hidden [&>div:first-child]:!h-full [&>div:first-child]:!min-h-0 [&>div:first-child]:!rounded-none [&>div:first-child]:!border-0">
            <WhatsAppInbox />
          </div>
        </div>
      )}
    </>
  );
};

export default WhatsAppInboxFloating;
