'use client';

// ── LMS · Bulk Email Composer ───────────────────────────────────────────────
// Marketing-side blast composer. Lives inside the Participants Database tab
// next to the contacts table. The flow is intentionally one-shot:
//   1. Pick recipients (from filtered participants table + paste-extras),
//      excluding anyone who has already unsubscribed.
//   2. Compose subject + rich-text body. Insert merge tokens via chips.
//   3. Preview the rendered email with a sample recipient's tokens filled.
//   4. Hit Send Email — server queues per-recipient rows and we walk them
//      one by one (with throttle + retry) while polling for the live
//      progress bar. Final summary lists every failure and offers a CSV
//      download + "Re-send to failures only" action.
// Past campaigns are listed below the composer so the marketer can drill
// into history for a re-send.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail, Send, Loader2, Search, CheckCircle2, AlertCircle, Filter,
  X as XIcon, Eye, RefreshCw, Download, History as HistoryIcon,
  ChevronDown, ChevronRight, Trash2, Tag, Users, ChevronLeft,
  Paperclip, MousePointerClick, Copy, Clock, CalendarClock, Hourglass,
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';

interface ParticipantRow {
  id: string;
  source: 'training' | 'imported';
  addedDate: string;
  title: string;
  fullName: string;
  email: string;
  countryCode: string;
  mobile: string;
  profession: string;
  organisation: string;
  unsubscribed?: boolean;
}

interface RecipientPayload {
  email: string;
  name: string;
  title: string;
  organisation: string;
}

interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

interface CampaignSummary {
  id: string;
  createdAt: string;
  subject: string;
  status: 'pending' | 'sending' | 'completed' | 'scheduled' | 'cancelled';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  attachments?: AttachmentMeta[];
  sendAt?: string | null;
}

interface CampaignCounts {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  skipped: number;
}
interface CampaignEngagementTotals {
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
}
interface CampaignClickByUrl {
  url: string;
  totalClicks: number;
  uniqueClickers: number;
}
interface CampaignClicksByDayRow {
  date: string;     // YYYY-MM-DD (UTC)
  url: string;      // empty string never returned — server emits per-URL rows
  totalClicks: number;
  uniqueClickers: number;
}
interface CampaignDetail extends CampaignSummary {
  bodyHtml: string;
  throttleMs: number;
  counts: CampaignCounts;
  attachments?: AttachmentMeta[];
  engagement?: CampaignEngagementTotals;
  clicksByUrl?: CampaignClickByUrl[];
  clicksByDay?: CampaignClicksByDayRow[];
  recipients: Array<{
    id: string;
    email: string;
    name: string;
    title: string;
    organisation: string;
    status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
    error?: string;
    sentAt?: string;
    attempts?: number;
    opened?: boolean;
    openCount?: number;
    firstOpenedAt?: string | null;
    clicked?: boolean;
    clickCount?: number;
    firstClickedAt?: string | null;
  }>;
}

interface SendBatchResult {
  ok?: boolean;
  processed?: number;
  remaining?: number;
  status?: 'sending' | 'completed';
  error?: string;
  // When the configured per-recipient delay can't fit in a single 230s
  // batch the server bows out early and returns the timestamp at which
  // the next send is allowed. The driver loop sleeps until then before
  // re-issuing /send so the spacing the marketer asked for is preserved.
  nextAllowedAt?: string;
}

const TOKENS = [
  { key: 'name',         label: 'Name',         hint: 'falls back to "there"' },
  { key: 'title',        label: 'Title / batch', hint: 'session or list label' },
  { key: 'organisation', label: 'Organisation', hint: 'company / institute' },
];

// Baseline throttle when the marketer hasn't asked for an explicit
// per-recipient delay — keeps us from saturating SMTP but doesn't pace
// recipients perceptibly. Used when `delayMinutes` is 0.
const FAST_THROTTLE_MS = 400;
// Upper bound on the per-recipient delay input. The send route accepts
// up to 60 minutes; we mirror the same cap on the client.
const MAX_DELAY_MINUTES = 60;
// Per-file cap (matches the upload-attachment route). Files are streamed
// directly to object storage now, so we no longer need a "total payload"
// budget — the campaign row itself only stores metadata + storage keys.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB per file
const MAX_ATTACHMENT_COUNT = 10;

interface ComposerAttachment {
  filename: string;
  contentType: string;
  size: number;
  // Returned by POST /api/marketing-campaigns/upload-attachment after the
  // file has been streamed into object storage. The campaign payload only
  // ever sends this key — never the file bytes.
  storageKey: string;
}

// In-flight upload tracked by the composer so we can render a per-file
// progress bar and let the marketer cancel a slow 25 MB upload.
interface UploadingAttachment {
  id: string;
  filename: string;
  size: number;
  loaded: number;
  // Pre-generated client-side so a cancel can reach into object storage
  // and remove the partial blob even though XHR.abort() severs the
  // request before the server can send a response.
  storageKey: string;
  xhr: XMLHttpRequest;
  cancelled: boolean;
}

// Mirrors `buildAttachmentStorageKey` on the server (yyyy-mm/uuid-name).
// The server validates the shape strictly so it can only target our own
// attachment prefix.
const buildClientStorageKey = (filename: string): string => {
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const safe = String(filename || '').trim().replace(/[\\/\x00-\x1f<>:"|?*]+/g, '_').slice(0, 200) || 'attachment';
  // Prefer crypto.randomUUID() when available (modern browsers); fall
  // back to a Math.random()-based UUIDv4 otherwise.
  let uuid: string;
  if (typeof crypto !== 'undefined' && typeof (crypto as Crypto & { randomUUID?: () => string }).randomUUID === 'function') {
    uuid = (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  } else {
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  return `marketing-campaigns/attachments/${yyyymm}/${uuid}-${safe}`;
};

const formatBytes = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const adminToken = (): string =>
  typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';

const csvEscape = (v: unknown): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Simple {{token}} replacer used purely for the in-page preview. The server
// does the real expansion (with HTML escaping) at send time.
const previewTokens = (html: string, ctx: Record<string, string>): string => {
  return html.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key) => {
    const k = String(key || '').toLowerCase();
    if (k === 'name') return ctx.name || 'there';
    if (k === 'title') return ctx.title || '';
    if (k === 'organisation' || k === 'organization') return ctx.organisation || '';
    if (k === 'email') return ctx.email || '';
    return '';
  });
};

export default function BulkEmailComposer({ items, onBack }: { items: ParticipantRow[]; onBack: () => void }) {
  // ── Recipient picker state ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'training' | 'imported'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraEmailsRaw, setExtraEmailsRaw] = useState('');

  // Recipients available after filtering + dropping unsubscribed.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(p => {
      if (p.unsubscribed) return false;
      if (!p.email) return false;
      if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.organisation.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.profession.toLowerCase().includes(q)
      );
    });
  }, [items, search, sourceFilter]);

  const selectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(p => next.add(p.id));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Parse the paste-extras textarea — accept commas, newlines, semicolons.
  const extraRecipients: RecipientPayload[] = useMemo(() => {
    const tokens = extraEmailsRaw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const out: RecipientPayload[] = [];
    for (const t of tokens) {
      const e = t.toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e)) continue;
      if (seen.has(e)) continue;
      seen.add(e);
      out.push({ email: e, name: '', title: '', organisation: '' });
    }
    return out;
  }, [extraEmailsRaw]);

  // Final, deduped recipient list pushed to the server on send. Picked rows
  // win on tie (their merge data is richer than a bare extra email).
  const recipients: RecipientPayload[] = useMemo(() => {
    const map = new Map<string, RecipientPayload>();
    items.forEach(p => {
      if (selected.has(p.id) && p.email && !p.unsubscribed) {
        const k = p.email.toLowerCase();
        if (!map.has(k)) {
          map.set(k, {
            email: p.email,
            name: p.fullName || '',
            title: p.title || '',
            organisation: p.organisation || '',
          });
        }
      }
    });
    extraRecipients.forEach(r => {
      if (!map.has(r.email)) map.set(r.email, r);
    });
    return Array.from(map.values());
  }, [items, selected, extraRecipients]);

  // ── Composer state ─────────────────────────────────────────────────────
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Attachments ────────────────────────────────────────────────────────
  // Files are streamed straight to object storage via POST
  // /api/marketing-campaigns/upload-attachment, which returns a storage
  // key. Only `{ filename, contentType, size, storageKey }` ever travels
  // in the campaign payload, so the campaign row stays small even for
  // 25 MB files (recorded webinars, big PDF catalogues, etc.).
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  // Live uploads tracked separately so we can render a progress bar +
  // cancel button per file. Each row carries its own XHR; cancelling
  // aborts the request and DELETEs the partial blob from object storage.
  const [uploads, setUploads] = useState<UploadingAttachment[]>([]);
  // Authoritative per-upload cancel flag. The XHR callbacks (onerror in
  // particular) can fire after `setUploads` has updated state but before
  // React re-renders, so reading the cancel flag from React state via a
  // closure is unreliable. A ref-keyed map mutated synchronously from
  // `cancelUpload()` gives a race-free signal.
  const cancelledUploadsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentTotal = useMemo(() => attachments.reduce((s, a) => s + a.size, 0), [attachments]);
  const attachmentUploading = uploads.length > 0;

  // Best-effort cleanup of a partial blob in object storage. Used both
  // when the marketer cancels mid-upload and when an upload errors out
  // after the server has already started writing bytes.
  const deleteStorageKey = (storageKey: string) => {
    if (!storageKey) return;
    void fetch('/api/marketing-campaigns/upload-attachment', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'x-admin-token': adminToken() },
      body: JSON.stringify({ storageKey }),
    }).catch(() => {});
  };

  // Upload a single file via XHR so we get upload.onprogress events
  // (fetch() doesn't expose upload progress in browsers yet). Returns
  // the completed attachment metadata, or null if the upload was
  // cancelled / failed (an error message is surfaced to the user).
  const uploadOne = (
    file: File,
    storageKey: string,
    uploadId: string,
  ): Promise<ComposerAttachment | null> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/marketing-campaigns/upload-attachment');
      xhr.setRequestHeader('x-admin-token', adminToken());

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        setUploads(prev => prev.map(u => (u.id === uploadId ? { ...u, loaded: ev.loaded } : u)));
      };
      xhr.onload = () => {
        let data: { error?: string; storageKey?: string; filename?: string; contentType?: string; size?: number } = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* non-JSON */ }
        if (xhr.status >= 200 && xhr.status < 300 && data?.storageKey) {
          resolve({
            filename: String(data.filename || file.name),
            contentType: String(data.contentType || file.type || 'application/octet-stream'),
            size: Number(data.size || file.size),
            storageKey: String(data.storageKey),
          });
        } else {
          // Server didn't accept the file — the partial blob (if any
          // bytes reached storage) is best cleaned up explicitly. The
          // server may also have written nothing, in which case the
          // DELETE is a harmless no-op (ignoreNotFound).
          deleteStorageKey(storageKey);
          setAttachmentError(`Could not upload "${file.name}": ${data?.error || `HTTP ${xhr.status}`}`);
          resolve(null);
        }
      };
      xhr.onerror = () => {
        // Network failure or aborted by user. For aborts the cancel
        // handler already showed feedback + scheduled the DELETE — only
        // surface an error message for genuine network failures. Read
        // the cancel flag from a ref so we get the synchronous,
        // closure-free truth (see cancelledUploadsRef).
        if (!cancelledUploadsRef.current.has(uploadId)) {
          deleteStorageKey(storageKey);
          setAttachmentError(`Could not upload "${file.name}": network error`);
        }
        resolve(null);
      };
      xhr.onabort = () => {
        // Cleanup is handled by cancelUpload() — nothing else to do.
        resolve(null);
      };

      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('storageKey', storageKey);
      xhr.send(fd);

      setUploads(prev => prev.map(u => (u.id === uploadId ? { ...u, xhr } : u)));
    });
  };

  const cancelUpload = (uploadId: string) => {
    // Flip the ref BEFORE aborting so the XHR's error/abort callbacks
    // see the cancel signal synchronously (React state updates are
    // batched and could otherwise lose the race).
    cancelledUploadsRef.current.add(uploadId);
    setUploads(prev => {
      const target = prev.find(u => u.id === uploadId);
      if (target) {
        try { target.xhr.abort(); } catch { /* ignore */ }
        deleteStorageKey(target.storageKey);
      }
      return prev.map(u => (u.id === uploadId ? { ...u, cancelled: true } : u));
    });
  };

  const handleAddAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError(null);
    const incoming = Array.from(files);
    if (attachments.length + uploads.length + incoming.length > MAX_ATTACHMENT_COUNT) {
      setAttachmentError(`At most ${MAX_ATTACHMENT_COUNT} attachments per campaign.`);
      return;
    }
    // Friendly per-file size pre-check (the upload endpoint enforces the
    // same cap authoritatively). No "total payload" cap any more — files
    // live in object storage, not on the campaign row.
    for (const f of incoming) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError(`"${f.name}" is ${formatBytes(f.size)}. Per-file limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
        return;
      }
    }

    // Spin up an UploadingAttachment row for each file and run all
    // uploads in parallel. Each row renders its own progress bar +
    // cancel button so a marketer can drop a slow file without giving
    // up on the rest of the batch.
    const queued = incoming.map((f) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storageKey = buildClientStorageKey(f.name);
      return { file: f, row: { id, filename: f.name, size: f.size, loaded: 0, storageKey, xhr: new XMLHttpRequest(), cancelled: false } as UploadingAttachment };
    });
    setUploads(prev => [...prev, ...queued.map(q => q.row)]);

    await Promise.all(queued.map(async ({ file, row }) => {
      const result = await uploadOne(file, row.storageKey, row.id);
      // Drop the row from the live list either way (success or fail);
      // successes get appended to the persistent attachments list.
      setUploads(prev => prev.filter(u => u.id !== row.id));
      cancelledUploadsRef.current.delete(row.id);
      if (result) {
        setAttachments(prev => [...prev, result]);
      }
    }));
  };

  const removeAttachment = (idx: number) => {
    const target = attachments[idx];
    setAttachments(prev => prev.filter((_, i) => i !== idx));
    setAttachmentError(null);
    // Best-effort: drop the orphaned blob from object storage so a
    // marketer who attaches-then-removes a file before sending doesn't
    // leave 25 MB of garbage in the bucket. Failures are silent — the
    // periodic sweep (follow-up) will catch anything we miss.
    if (target?.storageKey) {
      void fetch('/api/marketing-campaigns/upload-attachment', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', 'x-admin-token': adminToken() },
        body: JSON.stringify({ storageKey: target.storageKey }),
      }).catch(() => {});
    }
  };

  const sampleCtx = useMemo(() => {
    const sample = recipients[0];
    return {
      name: sample?.name || '',
      title: sample?.title || '',
      organisation: sample?.organisation || '',
      email: sample?.email || 'sample@example.com',
    };
  }, [recipients]);

  const insertToken = (token: string) => {
    // Append at the end — keeps the editor focus dance simple. The marketer
    // can copy/paste tokens around manually.
    setBodyHtml(prev => `${prev || ''} {{${token}}} `);
  };

  // ── Send + progress polling ────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<CampaignDetail | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const stopPollRef = useRef<boolean>(false);

  // ── Scheduling state ───────────────────────────────────────────────────
  // The composer offers a "Send now" / "Schedule for…" toggle. When the
  // marketer picks Schedule, the date/time control becomes the source of
  // truth and the Send button changes its label + payload accordingly.
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now');
  // Per-recipient delay in MINUTES. 0 = no pacing (uses FAST_THROTTLE_MS).
  // Anything > 0 means "wait this many minutes after each successful send
  // before claiming the next recipient". Honoured across batches via the
  // server-side `nextAllowedAt` checkpoint.
  const [delayMinutes, setDelayMinutes] = useState<number>(0);
  const [scheduleLocal, setScheduleLocal] = useState<string>(() => {
    // Default the picker to "tomorrow at 09:00" in the user's timezone so
    // they have a sensible starting point.
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
  });
  const scheduledIso = useMemo(() => {
    if (sendMode !== 'scheduled' || !scheduleLocal) return null;
    const t = new Date(scheduleLocal);
    if (isNaN(t.getTime())) return null;
    return t.toISOString();
  }, [sendMode, scheduleLocal]);
  const scheduleInPast = useMemo(() => {
    if (!scheduledIso) return false;
    return new Date(scheduledIso).getTime() <= Date.now() + 30_000;
  }, [scheduledIso]);

  // `summaryOnly` (counts + status, no per-recipient list) is used by the
  // live progress poll loop on large campaigns to keep payloads small.
  // The full recipient detail is only fetched when the loop ends or when
  // the user opens a campaign from history (CSV export, drilldown).
  const refreshActiveCampaign = async (id: string, summaryOnly = false): Promise<CampaignDetail | null> => {
    try {
      const qs = summaryOnly ? '?summary=1' : '';
      const res = await fetch(`/api/marketing-campaigns/${id}${qs}`, {
        cache: 'no-store',
        headers: { 'x-admin-token': adminToken() },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data as CampaignDetail;
    } catch { return null; }
  };

  // Hand-off used by the WYSIWYG body editor: pasted/dropped/inserted
  // images get pushed straight into the existing /api/academy/news-images
  // endpoint (which streams them publicly via a stable URL), and the
  // returned URL is what the editor inserts as the <img src>. This keeps
  // the email body well below Gmail's ~102KB clip threshold so recipients
  // see the full message instead of a "[Message clipped] View entire
  // message" notice. We return an ABSOLUTE URL so Gmail's image proxy
  // (which fetches images server-side) can reach it from outside the app.
  const uploadInlineImage = useCallback(async (dataUrl: string): Promise<string> => {
    const r = await fetch('/api/academy/news-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken() },
      body: JSON.stringify({ dataUrl }),
    });
    if (!r.ok) throw new Error(`Upload failed: HTTP ${r.status}`);
    const j = await r.json();
    if (!j?.url) throw new Error('Upload response missing url');
    if (/^https?:\/\//i.test(j.url)) return j.url;
    if (typeof window !== 'undefined') return `${window.location.origin}${j.url}`;
    return j.url;
  }, []);

  // Drives the send loop: POST /send (which may run for up to ~230s,
  // sending sequentially with throttle + retry), and CONCURRENTLY polls
  // /api/marketing-campaigns/[id] every second so the progress bar
  // increments in real time instead of jumping at the end of each batch.
  // Re-issues /send if the server returned with remaining > 0.
  const driveSendLoop = async (id: string, options?: { failuresOnly?: boolean }) => {
    stopPollRef.current = false;
    let firstBatchQueryString = options?.failuresOnly ? '?failuresOnly=1' : '';

    // Background poll — runs for the lifetime of the loop and keeps
    // `activeCampaign` in sync with the database while the long-running
    // /send request is still in flight on the server side.
    let pollAlive = true;
    const pollFn = async () => {
      while (pollAlive && !stopPollRef.current) {
        try {
          // Summary-only poll: counts + status, no recipient array. Saves
          // significant bandwidth on 10k-recipient campaigns where the
          // composer would otherwise re-download the entire roster every
          // second just to update the progress bar.
          const camp = await refreshActiveCampaign(id, true);
          if (camp) {
            setActiveCampaign(prev => ({
              ...(prev || {} as CampaignDetail),
              ...camp,
              recipients: prev?.recipients || [],
            }));
            const inFlight = (camp.counts.pending || 0) + (camp.counts.processing || 0);
            if (camp.status === 'completed' || inFlight === 0) break;
          }
        } catch { /* swallow, retry next tick */ }
        await new Promise(r => setTimeout(r, 1000));
      }
    };
    const pollPromise = pollFn();

    try {
      // Cap consecutive transient failures so we don't hammer the
      // endpoint forever if the server keeps returning 5xx.
      let consecutiveFailures = 0;
      const MAX_CONSECUTIVE_FAILURES = 3;
      while (!stopPollRef.current) {
        // Kick off a send batch. The server marches through pending rows
        // sequentially with the configured throttle + per-recipient retry.
        let batchRes: Response;
        try {
          batchRes = await fetch(`/api/marketing-campaigns/${id}/send${firstBatchQueryString}`, {
            method: 'POST',
            headers: { 'x-admin-token': adminToken() },
          });
          // Only the first batch carries the failuresOnly flag — once the
          // server has flipped the failed rows back to pending, subsequent
          // batches are normal resume calls.
          firstBatchQueryString = '';
        } catch {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            setSendError(`Send paused: network error after ${MAX_CONSECUTIVE_FAILURES} retries. Open the campaign from history to resume.`);
            break;
          }
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        // Server-side failure (auth, bug, DB error). Stop the loop and
        // surface a useful message instead of retrying forever.
        if (!batchRes.ok) {
          let errMsg = `Send failed (${batchRes.status}).`;
          try {
            const errBody = await batchRes.json() as SendBatchResult;
            if (errBody?.error) errMsg = `Send failed: ${errBody.error}`;
          } catch { /* non-JSON error body */ }
          setSendError(errMsg);
          // Authoritative refresh so the user can see what made it through.
          const camp = await refreshActiveCampaign(id);
          if (camp) setActiveCampaign(camp);
          break;
        }
        consecutiveFailures = 0;
        const batch = await batchRes.json().catch(() => ({} as SendBatchResult)) as SendBatchResult;
        // Authoritative refresh after the batch returns so totals match
        // exactly even if the poll missed the last increment.
        const camp = await refreshActiveCampaign(id);
        if (camp) setActiveCampaign(camp);
        // `processing` rows are still in flight (claimed but not yet
        // finalised) — only consider us done when both pending and
        // processing have drained.
        const stillInFlight = camp ? ((camp.counts.pending || 0) + (camp.counts.processing || 0)) : 1;
        if (batch?.status === 'completed' || stillInFlight === 0) break;
        // If the server asked us to wait until a specific time (because
        // the configured per-recipient delay couldn't fit in the safety
        // budget), honour that — otherwise fall back to a quick 600ms
        // tick so progress feels live for fast/no-delay campaigns.
        let nextDelayMs = 600;
        if (batch?.nextAllowedAt) {
          const waitUntil = new Date(batch.nextAllowedAt).getTime();
          if (Number.isFinite(waitUntil)) {
            nextDelayMs = Math.max(600, waitUntil - Date.now());
          }
        }
        await new Promise(r => setTimeout(r, nextDelayMs));
      }
    } finally {
      pollAlive = false;
      await pollPromise.catch(() => {});
    }
  };

  const handleSend = async () => {
    setSendError(null);
    if (!subject.trim()) { setSendError('Please enter a subject.'); return; }
    if (!bodyHtml.replace(/<[^>]+>/g, '').trim()) { setSendError('Email body is empty.'); return; }
    if (recipients.length === 0) { setSendError('Pick at least one recipient.'); return; }
    if (sendMode === 'scheduled') {
      if (!scheduledIso) { setSendError('Pick a valid send date and time.'); return; }
      if (scheduleInPast) { setSendError('Scheduled time must be at least 30 seconds in the future.'); return; }
    }
    const when = sendMode === 'scheduled' && scheduledIso
      ? `at ${new Date(scheduledIso).toLocaleString()}`
      : 'now';
    if (!confirm(`Send this email to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} ${when}?`)) return;

    setSending(true);
    try {
      const res = await fetch('/api/marketing-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken() },
        body: JSON.stringify({
          subject: subject.trim(),
          bodyHtml,
          recipients,
          throttleMs: delayMinutes > 0 ? delayMinutes * 60_000 : FAST_THROTTLE_MS,
          attachments: attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
            storageKey: a.storageKey,
          })),
          sendAt: sendMode === 'scheduled' ? scheduledIso : null,
        }),
      });
      const data = await res.json() as { id?: string; error?: string; status?: string };
      if (!res.ok || !data.id) {
        setSendError(data?.error || 'Could not start the campaign.');
        setSending(false);
        return;
      }
      // Single-owner lifecycle: the campaign now owns these storage
      // keys. Clear them from the composer so a follow-up send won't
      // accidentally reference the same blobs (which would later be
      // deleted when the first campaign is deleted).
      setAttachments([]);

      // Hydrate first snapshot for the progress UI, then drive the loop.
      const detail = await refreshActiveCampaign(data.id);
      if (detail) setActiveCampaign(detail);
      // For scheduled campaigns, we don't drive the send loop now — the
      // server-side run-due cron will promote + send when the time arrives.
      if (data.status === 'scheduled') {
        setSending(false);
        refreshHistory();
        return;
      }
      await driveSendLoop(data.id);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Network error — please try again.');
    }
    setSending(false);
    refreshHistory();
  };

  // Reschedule / cancel actions for a scheduled campaign in history.
  const reschedule = async (id: string) => {
    const def = (() => {
      const t = new Date(Date.now() + 24 * 3600_000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
    })();
    const input = prompt('Reschedule send time (YYYY-MM-DDTHH:MM, your local time):', def);
    if (!input) return;
    const t = new Date(input);
    if (isNaN(t.getTime())) { alert('Invalid date/time.'); return; }
    if (t.getTime() <= Date.now() + 30_000) { alert('Pick a time at least 30 seconds in the future.'); return; }
    try {
      const res = await fetch(`/api/marketing-campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken() },
        body: JSON.stringify({ sendAt: t.toISOString() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Reschedule failed: ${j?.error || res.status}`);
        return;
      }
    } catch { alert('Network error.'); return; }
    refreshHistory();
    if (openHistoryId === id) {
      const detail = await refreshActiveCampaign(id);
      if (detail) setOpenHistoryDetail(detail);
    }
  };
  const cancelScheduled = async (id: string) => {
    if (!confirm('Cancel this scheduled campaign? It will not be sent.')) return;
    try {
      const res = await fetch(`/api/marketing-campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken() },
        body: JSON.stringify({ cancel: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Cancel failed: ${j?.error || res.status}`);
        return;
      }
    } catch { alert('Network error.'); return; }
    refreshHistory();
    if (openHistoryId === id) {
      const detail = await refreshActiveCampaign(id);
      if (detail) setOpenHistoryDetail(detail);
    }
  };

  // ── History list ──────────────────────────────────────────────────────
  const [history, setHistory] = useState<CampaignSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [openHistoryDetail, setOpenHistoryDetail] = useState<CampaignDetail | null>(null);
  // null == "All links" (aggregate across every CTA); otherwise the URL the
  // marketer clicked in the Link performance panel to filter the timeline.
  const [selectedLinkUrl, setSelectedLinkUrl] = useState<string | null>(null);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/marketing-campaigns', {
        cache: 'no-store',
        headers: { 'x-admin-token': adminToken() },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {}
    setHistoryLoading(false);
  };

  useEffect(() => { refreshHistory(); }, []);

  const openHistory = async (id: string) => {
    if (openHistoryId === id) {
      setOpenHistoryId(null);
      setOpenHistoryDetail(null);
      setSelectedLinkUrl(null);
      return;
    }
    setOpenHistoryId(id);
    setOpenHistoryDetail(null);
    setSelectedLinkUrl(null);
    const detail = await refreshActiveCampaign(id);
    if (detail) setOpenHistoryDetail(detail);
  };

  const downloadCampaignCsv = (camp: CampaignDetail) => {
    const header = ['Email', 'Name', 'Title', 'Organisation', 'Status', 'Attempts', 'Sent At', 'Opened', 'Opens', 'First Opened At', 'Clicked', 'Clicks', 'First Clicked At', 'Error'];
    const rows = camp.recipients.map(r => [
      r.email, r.name, r.title, r.organisation, r.status, r.attempts || 0,
      r.sentAt || '',
      r.opened ? 'yes' : 'no', r.openCount || 0, r.firstOpenedAt || '',
      r.clicked ? 'yes' : 'no', r.clickCount || 0, r.firstClickedAt || '',
      r.error || '',
    ]);
    const recipientCsv = [header.map(csvEscape).join(','), ...rows.map(row => row.map(csvEscape).join(','))].join('\n');

    // Second section: per-link breakdown. Same file, blank-line separated, with
    // its own header row so it imports cleanly as a second sheet in spreadsheets.
    const linkHeader = ['URL', 'Total Clicks', 'Unique Clickers'];
    const linkRows = (camp.clicksByUrl || []).map(l => [l.url, l.totalClicks, l.uniqueClickers]);
    const linkCsv = [
      'Link performance',
      linkHeader.map(csvEscape).join(','),
      ...linkRows.map(row => row.map(csvEscape).join(',')),
    ].join('\n');

    const csv = `${recipientCsv}\n\n${linkCsv}\n`;
    const stamp = new Date(camp.createdAt).toISOString().slice(0, 10);
    downloadCsv(`bulk-email-${stamp}-${camp.id.slice(0, 8)}.csv`, csv);
  };

  const resendFailures = async (id: string) => {
    if (!confirm('Re-queue every failed recipient and re-send?')) return;
    setSendError(null);
    const detail = await refreshActiveCampaign(id);
    if (detail) setActiveCampaign(detail);
    setSending(true);
    // Routing through driveSendLoop with failuresOnly=true means the
    // concurrent poll picks up live progress from the very first batch,
    // and any 5xx is surfaced through the same setSendError path as the
    // initial send.
    try {
      await driveSendLoop(id, { failuresOnly: true });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Network error during resend.');
    }
    setSending(false);
    refreshHistory();
  };

  // Pre-fill the composer with subject/body/attachments from a past
  // campaign so the marketer can re-send the same blast (typically next
  // month) without re-uploading every file. When `copyRecipients` is true
  // we also pre-select every participant whose email matched the original
  // campaign's recipient list (skipping anyone now unsubscribed) — handy
  // for monthly newsletters that go to the same audience.
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const duplicateCampaign = async (id: string, copyRecipients = false) => {
    const draftDirty =
      subject.trim() ||
      bodyHtml.replace(/<[^>]+>/g, '').trim() ||
      attachments.length > 0;
    // When also copying recipients we'll wipe the current pick + extras box,
    // so any in-progress audience counts as "dirty draft" too — otherwise a
    // marketer who has already ticked rows could lose them silently.
    const audienceDirty = copyRecipients && (selected.size > 0 || extraEmailsRaw.trim().length > 0);
    if (draftDirty || audienceDirty) {
      const msg = copyRecipients
        ? 'Replace the current draft with a copy of this past campaign? Your unsaved subject, body, attachments, and picked recipients will be overwritten.'
        : 'Replace the current draft with a copy of this past campaign? Your unsaved subject, body, and attachments will be overwritten.';
      if (!confirm(msg)) return;
    }
    setDuplicatingId(id);
    setSendError(null);
    setAttachmentError(null);
    try {
      // Two parallel fetches: one for the full attachment blobs (the
      // `?include=attachments` shortcut skips the recipients table read),
      // and — only if needed — one for the per-recipient list.
      const [attachRes, recipRes] = await Promise.all([
        fetch(`/api/marketing-campaigns/${id}?include=attachments`, {
          cache: 'no-store',
          headers: { 'x-admin-token': adminToken() },
        }),
        copyRecipients
          ? fetch(`/api/marketing-campaigns/${id}`, {
              cache: 'no-store',
              headers: { 'x-admin-token': adminToken() },
            })
          : Promise.resolve(null),
      ]);
      if (!attachRes.ok) {
        setSendError('Could not load that campaign to duplicate.');
        return;
      }
      const data = await attachRes.json() as {
        subject?: string;
        bodyHtml?: string;
        attachments?: Array<{
          filename?: string;
          contentType?: string;
          size?: number;
          storageKey?: string;
        }>;
      };
      setSubject(String(data.subject || ''));
      setBodyHtml(String(data.bodyHtml || ''));
      // Ask the server to clone each attachment to a fresh storage key
      // so this draft owns its own blobs (single-owner lifecycle). Old
      // campaigns from before the storage migration won't have a
      // storageKey and are skipped.
      const cloneItems = Array.isArray(data.attachments)
        ? data.attachments.filter((a): a is { filename: string; contentType?: string; size?: number; storageKey: string } =>
            !!a && typeof a.filename === 'string' && !!a.filename && typeof a.storageKey === 'string' && !!a.storageKey,
          )
        : [];
      let incoming: ComposerAttachment[] = [];
      if (cloneItems.length > 0) {
        const cloneRes = await fetch('/api/marketing-campaigns/clone-attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken() },
          body: JSON.stringify({ items: cloneItems }),
        });
        const cloneData = await cloneRes.json().catch(() => ({} as { items?: ComposerAttachment[]; error?: string }));
        if (!cloneRes.ok) {
          setSendError(`Could not duplicate attachments: ${cloneData?.error || `HTTP ${cloneRes.status}`}`);
          return;
        }
        incoming = Array.isArray(cloneData?.items) ? cloneData.items : [];
      }
      setAttachments(incoming);

      if (copyRecipients) {
        if (recipRes && recipRes.ok) {
          const full = await recipRes.json() as {
            recipients?: Array<{ email?: string }>;
          };
          const wantedEmails = new Set(
            (full.recipients || [])
              .map(r => String(r.email || '').toLowerCase().trim())
              .filter(Boolean)
          );
          // Match by lowercased email against the live participants table,
          // skipping anyone now unsubscribed. We do not stuff missing
          // emails into the extras box — the task only asks to pre-select
          // rows whose email "still exists in the participants table".
          const nextSelected = new Set<string>();
          for (const p of items) {
            if (!p.email || p.unsubscribed) continue;
            if (wantedEmails.has(p.email.toLowerCase().trim())) {
              nextSelected.add(p.id);
            }
          }
          setSelected(nextSelected);
          setExtraEmailsRaw('');
        } else {
          setSendError('Loaded the draft, but could not copy the recipient list.');
        }
      }

      // Collapse the history row so the composer is in view at the top.
      setOpenHistoryId(null);
      setOpenHistoryDetail(null);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSendError('Network error while duplicating the campaign.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign and all its per-recipient logs?')) return;
    try {
      await fetch(`/api/marketing-campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken() },
      });
    } catch {}
    setOpenHistoryId(null);
    setOpenHistoryDetail(null);
    refreshHistory();
  };

  // Live counters
  const pickedCount = Array.from(selected).filter(id => {
    const p = items.find(x => x.id === id);
    return p && p.email && !p.unsubscribed;
  }).length;

  const recipientCount = recipients.length;
  const isScheduledActive = !!activeCampaign && activeCampaign.status === 'scheduled';
  const inProgress = !isScheduledActive && (sending || (activeCampaign && activeCampaign.status !== 'completed' && activeCampaign.status !== 'cancelled'));
  const sendDone = activeCampaign && activeCampaign.status === 'completed';
  const sentN = activeCampaign?.counts?.sent ?? activeCampaign?.sentCount ?? 0;
  const failedN = activeCampaign?.counts?.failed ?? activeCampaign?.failedCount ?? 0;
  const skippedN = activeCampaign?.counts?.skipped ?? 0;
  const totalN = activeCampaign?.totalRecipients ?? 0;
  const pct = totalN > 0 ? Math.round(((sentN + failedN + skippedN) / totalN) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">
            <ChevronLeft size={14} /> Back to Contacts
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-md">
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Bulk Email</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Marketing · Reaches {recipientCount.toLocaleString()} recipient{recipientCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Live progress / completion banner */}
      {activeCampaign && (
        <div className="px-6 pt-4">
          <div className={`rounded-2xl border p-4 shadow-sm ${
            isScheduledActive ? 'bg-rose-50 border-rose-200'
              : sendDone
                ? failedN > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                : 'bg-indigo-50 border-indigo-200'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {isScheduledActive ? <CalendarClock size={16} className="text-rose-600" /> :
                 inProgress ? <Loader2 size={16} className="animate-spin text-indigo-600" /> :
                 failedN > 0 ? <AlertCircle size={16} className="text-amber-600" /> :
                 <CheckCircle2 size={16} className="text-emerald-600" />}
                <span className="text-sm font-black text-slate-800">
                  {isScheduledActive
                    ? `Scheduled for ${activeCampaign?.sendAt ? new Date(activeCampaign.sendAt).toLocaleString() : '—'} · ${totalN} recipient${totalN === 1 ? '' : 's'} queued`
                    : inProgress
                      ? `Sending — ${sentN} of ${totalN} · ${failedN} failed`
                      : `Done — ${sentN} sent · ${failedN} failed${skippedN ? ` · ${skippedN} skipped` : ''}`}
                </span>
              </div>
              {sendDone && (
                <div className="flex items-center gap-2">
                  <button onClick={() => downloadCampaignCsv(activeCampaign)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <Download size={12} /> Report CSV
                  </button>
                  {failedN > 0 && (
                    <button onClick={() => resendFailures(activeCampaign.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700">
                      <RefreshCw size={12} /> Re-send to failures only
                    </button>
                  )}
                  <button onClick={() => setActiveCampaign(null)}
                    className="p-1.5 rounded hover:bg-white/60 text-slate-500" title="Dismiss">
                    <XIcon size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 h-2 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            {sendDone && failedN > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Failed addresses</p>
                <div className="max-h-40 overflow-y-auto bg-white border border-amber-200 rounded-lg">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {activeCampaign.recipients.filter(r => r.status === 'failed').slice(0, 50).map(r => (
                        <tr key={r.id} className="border-b border-amber-100 last:border-b-0">
                          <td className="px-2 py-1 font-mono text-slate-700">{r.email}</td>
                          <td className="px-2 py-1 text-rose-600 truncate max-w-[420px]" title={r.error}>{r.error || 'Unknown error'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-6 py-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ── Left column: Recipient picker + extras ─────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-indigo-600" />
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Recipients</h2>
            </div>
            <div className="text-[11px] font-bold text-slate-500">
              {recipientCount.toLocaleString()} total · {pickedCount} picked + {extraRecipients.length} extras
            </div>
          </div>

          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, organisation…"
                className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Filter size={11} /> Source
            </div>
            <div className="inline-flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {(['all', 'training', 'imported'] as const).map(s => (
                <button key={s} onClick={() => setSourceFilter(s)}
                  className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                    sourceFilter === s ? 'bg-white text-violet-700 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {s === 'all' ? 'All' : s === 'training' ? 'LMS' : 'Imported'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              {filtered.length.toLocaleString()} contact{filtered.length === 1 ? '' : 's'} match the filter
            </p>
            <div className="flex gap-1.5">
              <button onClick={selectAllFiltered}
                className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100">
                Select all filtered
              </button>
              <button onClick={clearSelection}
                className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider hover:bg-slate-100">
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[340px]">
            <table className="w-full text-[11px]">
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-slate-400">No contacts match the current filter.</td></tr>
                ) : filtered.map(p => {
                  const checked = selected.has(p.id);
                  return (
                    <tr key={p.id} onClick={() => toggleOne(p.id)}
                      className={`border-t border-slate-100 cursor-pointer ${checked ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-3 py-1.5 w-6">
                        <input type="checkbox" checked={checked} onChange={() => toggleOne(p.id)}
                          onClick={e => e.stopPropagation()} className="accent-indigo-600" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-bold text-slate-800">{p.fullName || '—'}</div>
                        <div className="font-mono text-slate-500">{p.email}</div>
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[180px] truncate" title={p.organisation}>{p.organisation || ''}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          p.source === 'training' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {p.source === 'training' ? 'LMS' : 'Imported'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
              Add extra emails (one per line, comma- or semicolon-separated)
            </label>
            <textarea value={extraEmailsRaw} onChange={e => setExtraEmailsRaw(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              className="w-full h-20 p-2 rounded-lg border border-slate-200 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
            <p className="text-[10px] text-slate-400 mt-1">
              {extraRecipients.length} valid extra address{extraRecipients.length === 1 ? '' : 'es'} parsed.
              Duplicates of picked contacts are merged automatically.
            </p>
          </div>
        </div>

        {/* ── Right column: Composer ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-rose-600" />
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Compose</h2>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleAddAttachments(e.target.files);
                  // Reset so the same file can be re-picked later if removed.
                  if (e.target) e.target.value = '';
                }}
              />
              <button onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50">
                <Paperclip size={12} /> Add attachment
              </button>
              <button onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50">
                <Eye size={12} /> Preview
              </button>
              <button onClick={handleSend} disabled={sending || attachmentUploading || recipientCount === 0 || !subject.trim() || (sendMode === 'scheduled' && (!scheduledIso || scheduleInPast))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-rose-600 to-orange-500 text-white text-[11px] font-black uppercase tracking-wider shadow disabled:opacity-50">
                {sending ? <Loader2 size={12} className="animate-spin" /> :
                 sendMode === 'scheduled' ? <CalendarClock size={12} /> : <Send size={12} />}
                {sendMode === 'scheduled' ? 'Schedule' : 'Send Email'}
              </button>
            </div>
          </div>

          <div className="px-4 pt-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Subject line — supports {{name}}, {{title}}, {{organisation}}"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
          </div>

          <div className="px-4 pt-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 inline-flex items-center gap-1">
              <Clock size={11} /> When to send
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {(['now', 'scheduled'] as const).map(m => (
                  <button key={m} onClick={() => setSendMode(m)} type="button"
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                      sendMode === m ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                    {m === 'now' ? 'Send now' : 'Schedule for…'}
                  </button>
                ))}
              </div>
              {sendMode === 'scheduled' && (
                <>
                  <input
                    type="datetime-local"
                    value={scheduleLocal}
                    onChange={e => setScheduleLocal(e.target.value)}
                    className={`px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-rose-200 ${
                      scheduleInPast ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400">
                    {scheduledIso && !scheduleInPast
                      ? `→ ${new Date(scheduledIso).toLocaleString()}`
                      : scheduleInPast ? 'Pick a future time' : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="px-4 pt-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 inline-flex items-center gap-1">
              <Hourglass size={11} /> Delay between sends
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                max={MAX_DELAY_MINUTES}
                step={1}
                value={delayMinutes}
                onChange={e => {
                  const n = Math.max(0, Math.min(MAX_DELAY_MINUTES, Math.floor(Number(e.target.value) || 0)));
                  setDelayMinutes(n);
                }}
                className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 tabular-nums"
              />
              <span className="text-[10px] font-bold text-slate-500">
                minute{delayMinutes === 1 ? '' : 's'} between each recipient
              </span>
              <span className="text-[10px] text-slate-400">
                {delayMinutes === 0
                  ? '· No pacing — sends as fast as SMTP allows'
                  : `· Each email goes out ${delayMinutes} minute${delayMinutes === 1 ? '' : 's'} after the previous one (max ${MAX_DELAY_MINUTES})`}
              </span>
            </div>
          </div>

          <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1 inline-flex items-center gap-1">
              <Tag size={11} /> Insert token
            </span>
            {TOKENS.map(t => (
              <button key={t.key} onClick={() => insertToken(t.key)} title={t.hint}
                className="px-2 py-1 rounded-md bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-black hover:bg-violet-100">
                {`{{${t.key}}}`}
              </button>
            ))}
          </div>

          <div className="mt-3 flex-1">
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Hi {{name}}, …"
              minHeight="320px"
              onUploadImage={uploadInlineImage}
            />
          </div>

          {(attachments.length > 0 || uploads.length > 0 || attachmentError) && (
            <div className="mx-4 mt-3">
              {uploads.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest inline-flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> Uploading · {uploads.length}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {uploads.map((u) => {
                      const pct = u.size > 0 ? Math.min(100, Math.round((u.loaded / u.size) * 100)) : 0;
                      return (
                        <li key={u.id}
                          className="px-2.5 py-1.5 bg-indigo-50/60 border border-indigo-200 rounded-lg text-[11px]">
                          <div className="flex items-center gap-2">
                            <Paperclip size={11} className="text-indigo-400 shrink-0" />
                            <span className="font-bold text-slate-700 truncate flex-1" title={u.filename}>{u.filename}</span>
                            <span className="text-slate-500 shrink-0 tabular-nums">
                              {formatBytes(u.loaded)} / {formatBytes(u.size)} · {pct}%
                            </span>
                            <button onClick={() => cancelUpload(u.id)}
                              className="p-0.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 shrink-0"
                              title="Cancel upload">
                              <XIcon size={12} />
                            </button>
                          </div>
                          <div className="mt-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-[width] duration-150"
                              style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {attachments.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest inline-flex items-center gap-1">
                      <Paperclip size={11} /> Attachments · {attachments.length}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {formatBytes(attachmentTotal)} · up to {formatBytes(MAX_ATTACHMENT_BYTES)}/file
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {attachments.map((a, i) => (
                      <li key={`${a.filename}-${i}`}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                        <Paperclip size={11} className="text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-700 truncate flex-1" title={a.filename}>{a.filename}</span>
                        <span className="text-slate-400 shrink-0">{formatBytes(a.size)}</span>
                        <button onClick={() => removeAttachment(i)}
                          className="p-0.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 shrink-0"
                          title="Remove">
                          <XIcon size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {attachmentError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} /> {attachmentError}
                </div>
              )}
            </div>
          )}
          {sendError && (
            <div className="mx-4 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle size={14} /> {sendError}
            </div>
          )}
          <div className="px-4 pb-3 text-[10px] text-slate-400">
            Each email is sent one at a time from <strong className="text-slate-600">training@safefoodmitra.co.in</strong>
            {delayMinutes > 0
              ? <> with a <strong className="text-slate-600">{delayMinutes}-minute</strong> gap between recipients</>
              : <> as fast as SMTP allows</>}
            {' '}and an automatic unsubscribe link in the footer.
          </div>
        </div>
      </div>

      {/* ── Campaign history ──────────────────────────────────────── */}
      <div className="px-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HistoryIcon size={14} className="text-slate-500" />
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Campaign History</h2>
            </div>
            <button onClick={refreshHistory} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Refresh">
              {historyLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>
          {history.length === 0 && !historyLoading ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">
              No campaigns yet. Compose and send your first blast above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map(c => {
                const open = openHistoryId === c.id;
                return (
                  <div key={c.id}>
                    <button onClick={() => openHistory(c.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left">
                      {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-slate-800 truncate">{c.subject || '(no subject)'}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {new Date(c.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {c.totalRecipients} recipient{c.totalRecipients === 1 ? '' : 's'}
                          {c.status === 'scheduled' && c.sendAt && (
                            <span className="ml-1 text-rose-600">
                              · scheduled for {new Date(c.sendAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); void duplicateCampaign(c.id); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              void duplicateCampaign(c.id);
                            }
                          }}
                          aria-disabled={duplicatingId === c.id}
                          title="Load subject, body, and attachments into the composer"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 ${
                            duplicatingId === c.id ? 'opacity-60 pointer-events-none' : ''
                          }`}>
                          {duplicatingId === c.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Copy size={10} />}
                          Duplicate
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); void duplicateCampaign(c.id, true); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              void duplicateCampaign(c.id, true);
                            }
                          }}
                          aria-disabled={duplicatingId === c.id}
                          title="Also pre-select the same recipients (skipping anyone now unsubscribed)"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 ${
                            duplicatingId === c.id ? 'opacity-60 pointer-events-none' : ''
                          }`}>
                          {duplicatingId === c.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Copy size={10} />}
                          + Recipients
                        </span>
                        {c.attachments && c.attachments.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 inline-flex items-center gap-1"
                            title={c.attachments.map(a => `${a.filename} (${formatBytes(a.size)})`).join('\n')}>
                            <Paperclip size={10} /> {c.attachments.length}
                          </span>
                        )}
                        {c.status !== 'scheduled' && c.status !== 'cancelled' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{c.sentCount} sent</span>
                        )}
                        {c.failedCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">{c.failedCount} failed</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded ${
                          c.status === 'completed' ? 'bg-slate-100 text-slate-600'
                            : c.status === 'sending' ? 'bg-indigo-50 text-indigo-700'
                            : c.status === 'scheduled' ? 'bg-rose-50 text-rose-700'
                            : c.status === 'cancelled' ? 'bg-slate-100 text-slate-400 line-through'
                            : 'bg-amber-50 text-amber-700'
                        }`}>{c.status}</span>
                      </div>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 bg-slate-50/40">
                        {!openHistoryDetail ? (
                          <div className="py-4 text-center text-xs text-slate-400">
                            <Loader2 size={14} className="animate-spin inline-block mr-1" /> Loading…
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 py-3 flex-wrap">
                              {openHistoryDetail.status === 'scheduled' && (
                                <>
                                  <button onClick={() => reschedule(openHistoryDetail.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700">
                                    <CalendarClock size={12} /> Reschedule
                                  </button>
                                  <button onClick={() => cancelScheduled(openHistoryDetail.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50">
                                    <XIcon size={12} /> Cancel send
                                  </button>
                                </>
                              )}
                              <button onClick={() => downloadCampaignCsv(openHistoryDetail)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
                                <Download size={12} /> Download report CSV
                              </button>
                              {openHistoryDetail.failedCount > 0 && (
                                <button onClick={() => resendFailures(openHistoryDetail.id)}
                                  disabled={sending}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50">
                                  <RefreshCw size={12} /> Re-send to failures only
                                </button>
                              )}
                              <button onClick={() => deleteCampaign(openHistoryDetail.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 ml-auto">
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                            {(() => {
                              // Engagement aggregate strip — opens/clicks against sent
                              // (not totalRecipients) so % reflects deliverable audience.
                              const sentDenom = openHistoryDetail.counts?.sent ?? openHistoryDetail.sentCount ?? 0;
                              const eng = openHistoryDetail.engagement || { uniqueOpens: 0, totalOpens: 0, uniqueClicks: 0, totalClicks: 0 };
                              const openPct = sentDenom > 0 ? Math.round((eng.uniqueOpens / sentDenom) * 100) : 0;
                              const clickPct = sentDenom > 0 ? Math.round((eng.uniqueClicks / sentDenom) * 100) : 0;
                              const ctr = eng.uniqueOpens > 0 ? Math.round((eng.uniqueClicks / eng.uniqueOpens) * 100) : 0;
                              return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sent</div>
                                    <div className="text-base font-black text-slate-800">{sentDenom.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
                                    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1"><Eye size={9} /> Opens</div>
                                    <div className="text-base font-black text-emerald-700">{eng.uniqueOpens.toLocaleString()} <span className="text-[10px] font-bold text-emerald-500">({openPct}%)</span></div>
                                    <div className="text-[9px] text-slate-400">{eng.totalOpens.toLocaleString()} total</div>
                                  </div>
                                  <div className="bg-white border border-indigo-200 rounded-lg px-3 py-2">
                                    <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1"><MousePointerClick size={9} /> Clicks</div>
                                    <div className="text-base font-black text-indigo-700">{eng.uniqueClicks.toLocaleString()} <span className="text-[10px] font-bold text-indigo-500">({clickPct}%)</span></div>
                                    <div className="text-[9px] text-slate-400">{eng.totalClicks.toLocaleString()} total</div>
                                  </div>
                                  <div className="bg-white border border-violet-200 rounded-lg px-3 py-2">
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Click-through</div>
                                    <div className="text-base font-black text-violet-700">{ctr}%</div>
                                    <div className="text-[9px] text-slate-400">clicks ÷ opens</div>
                                  </div>
                                </div>
                              );
                            })()}
                            {(() => {
                              // Click timeline — bucket per-URL day rows from the API
                              // into a single per-day series, optionally filtered to one
                              // CTA picked from the Link performance panel below. Days
                              // with zero clicks between the first and last recorded
                              // event are filled in so the bar chart shows engagement
                              // decay (or a re-share spike) rather than a misleading
                              // continuous run of bars.
                              const rows = openHistoryDetail.clicksByDay || [];
                              if (rows.length === 0) return null;
                              const filtered = selectedLinkUrl
                                ? rows.filter(r => r.url === selectedLinkUrl)
                                : rows;
                              if (filtered.length === 0) return null;
                              const byDay = new Map<string, number>();
                              for (const r of filtered) {
                                byDay.set(r.date, (byDay.get(r.date) || 0) + r.totalClicks);
                              }
                              const sortedDates = Array.from(byDay.keys()).sort();
                              const firstAll = sortedDates[0];
                              const lastAll = sortedDates[sortedDates.length - 1];
                              // Fill missing days so the bar chart spans first→last
                              // contiguously. If the full span exceeds MAX_BARS we show
                              // the most recent window — recency is what marketers care
                              // about — and surface the truncation in the chart header
                              // so the date labels can never disagree with the bars.
                              const series: Array<{ date: string; clicks: number }> = [];
                              const DAY = 86400000;
                              const MAX_BARS = 90;
                              let fullSpan = 0;
                              let truncated = false;
                              if (firstAll && lastAll) {
                                const startAll = new Date(firstAll + 'T00:00:00Z').getTime();
                                const endAll = new Date(lastAll + 'T00:00:00Z').getTime();
                                fullSpan = Math.round((endAll - startAll) / DAY) + 1;
                                truncated = fullSpan > MAX_BARS;
                                const renderedSpan = Math.min(fullSpan, MAX_BARS);
                                // Anchor at the most recent day so the rightmost bar
                                // always matches `lastAll`, then walk backwards.
                                const renderStart = endAll - (renderedSpan - 1) * DAY;
                                for (let i = 0; i < renderedSpan; i++) {
                                  const d = new Date(renderStart + i * DAY).toISOString().slice(0, 10);
                                  series.push({ date: d, clicks: byDay.get(d) || 0 });
                                }
                              }
                              const first = series[0]?.date || '';
                              const last = series[series.length - 1]?.date || '';
                              const peak = series.reduce((m, s) => Math.max(m, s.clicks), 0);
                              const total = series.reduce((s, x) => s + x.clicks, 0);
                              const fmtDay = (iso: string) =>
                                new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
                              return (
                                <div className="bg-white border border-indigo-200 rounded-lg overflow-hidden mb-3">
                                  <div className="px-3 py-2 bg-indigo-50/60 border-b border-indigo-100 flex items-center gap-2 flex-wrap">
                                    <MousePointerClick size={12} className="text-indigo-600" />
                                    <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Click timeline</div>
                                    <div className="inline-flex bg-white rounded-md border border-indigo-100 p-0.5 gap-0.5 ml-2">
                                      <button
                                        onClick={() => setSelectedLinkUrl(null)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-colors ${
                                          selectedLinkUrl === null ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-700'
                                        }`}
                                      >
                                        All links
                                      </button>
                                      {selectedLinkUrl && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white max-w-[220px] truncate"
                                          title={selectedLinkUrl}>
                                          {selectedLinkUrl.replace(/^https?:\/\//, '').slice(0, 32)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 ml-auto"
                                      title={truncated ? `Full span ${fullSpan} days; showing the most recent ${MAX_BARS}.` : undefined}>
                                      {total.toLocaleString()} click{total === 1 ? '' : 's'} ·{' '}
                                      {truncated
                                        ? <span className="text-amber-600 font-bold">last {series.length} of {fullSpan} days</span>
                                        : <>{series.length} day{series.length === 1 ? '' : 's'}</>}
                                      {' · UTC'}
                                    </div>
                                  </div>
                                  <div className="px-3 pt-3 pb-2">
                                    <div className="flex items-end gap-1 h-28">
                                      {series.map(s => {
                                        const h = peak > 0 ? Math.max(2, Math.round((s.clicks / peak) * 100)) : 2;
                                        return (
                                          <div key={s.date} className="flex-1 min-w-[4px] flex flex-col items-center justify-end h-full group">
                                            <div className="text-[9px] font-black text-indigo-700 opacity-0 group-hover:opacity-100 mb-0.5 tabular-nums">
                                              {s.clicks}
                                            </div>
                                            <div
                                              className={`w-full rounded-t ${s.clicks > 0 ? 'bg-indigo-500 group-hover:bg-indigo-600' : 'bg-slate-100'}`}
                                              style={{ height: `${h}%` }}
                                              title={`${fmtDay(s.date)} · ${s.clicks} click${s.clicks === 1 ? '' : 's'}`}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center justify-between mt-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                      <span>{first ? fmtDay(first) : ''}</span>
                                      {series.length > 2 && (
                                        <span>{fmtDay(series[Math.floor(series.length / 2)].date)}</span>
                                      )}
                                      <span>{last ? fmtDay(last) : ''}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            {(() => {
                              // Link performance panel — per-URL click breakdown so
                              // marketers can see which CTA is actually pulling traffic.
                              // Sorted by total clicks desc on the server. Hidden when
                              // no clicks have been recorded yet. Click a row to filter
                              // the click timeline above to that single URL.
                              const links = openHistoryDetail.clicksByUrl || [];
                              if (links.length === 0) return null;
                              const topClicks = links[0]?.totalClicks || 0;
                              return (
                                <div className="bg-white border border-indigo-200 rounded-lg overflow-hidden mb-3">
                                  <div className="px-3 py-2 bg-indigo-50/60 border-b border-indigo-100 flex items-center gap-2">
                                    <MousePointerClick size={12} className="text-indigo-600" />
                                    <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Link performance</div>
                                    <div className="text-[10px] text-slate-500 ml-auto">
                                      {links.length} unique link{links.length === 1 ? '' : 's'} · click a row to filter the timeline
                                    </div>
                                  </div>
                                  <div className="max-h-56 overflow-y-auto">
                                    <table className="w-full text-[11px]">
                                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[9px] font-black sticky top-0">
                                        <tr>
                                          <th className="px-2 py-1.5 text-left">URL</th>
                                          <th className="px-2 py-1.5 text-right w-20">Clicks</th>
                                          <th className="px-2 py-1.5 text-right w-24">Unique</th>
                                          <th className="px-2 py-1.5 text-left w-28">Share</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {links.map(l => {
                                          const pct = topClicks > 0 ? Math.round((l.totalClicks / topClicks) * 100) : 0;
                                          const active = selectedLinkUrl === l.url;
                                          return (
                                            <tr
                                              key={l.url}
                                              onClick={() => setSelectedLinkUrl(active ? null : l.url)}
                                              className={`border-t border-slate-100 cursor-pointer ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                              title={active ? 'Click to clear filter' : 'Click to filter the timeline to this URL'}
                                            >
                                              <td className="px-2 py-1 font-mono text-slate-700 truncate max-w-[360px]" title={l.url}>
                                                <a
                                                  href={l.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={e => e.stopPropagation()}
                                                  className="text-indigo-700 hover:underline"
                                                >{l.url}</a>
                                              </td>
                                              <td className="px-2 py-1 text-right font-bold text-indigo-700 tabular-nums">{l.totalClicks.toLocaleString()}</td>
                                              <td className="px-2 py-1 text-right text-slate-600 tabular-nums">{l.uniqueClickers.toLocaleString()}</td>
                                              <td className="px-2 py-1">
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                  <div className={`h-full ${active ? 'bg-indigo-700' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                              <table className="w-full text-[11px]">
                                <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[9px] font-black sticky top-0">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left">Email</th>
                                    <th className="px-2 py-1.5 text-left">Name</th>
                                    <th className="px-2 py-1.5 text-left">Status</th>
                                    <th className="px-2 py-1.5 text-left">Opens</th>
                                    <th className="px-2 py-1.5 text-left">Clicks</th>
                                    <th className="px-2 py-1.5 text-left">Detail</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {openHistoryDetail.recipients.map(r => (
                                    <tr key={r.id} className="border-t border-slate-100">
                                      <td className="px-2 py-1 font-mono text-slate-700">{r.email}</td>
                                      <td className="px-2 py-1 text-slate-700">{r.name || '—'}</td>
                                      <td className="px-2 py-1">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                          r.status === 'sent' ? 'bg-emerald-50 text-emerald-700'
                                            : r.status === 'failed' ? 'bg-rose-50 text-rose-700'
                                            : r.status === 'skipped' ? 'bg-slate-100 text-slate-500'
                                            : 'bg-amber-50 text-amber-700'
                                        }`}>{r.status}</span>
                                      </td>
                                      <td className="px-2 py-1" title={r.firstOpenedAt ? `First opened ${new Date(r.firstOpenedAt).toLocaleString('en-GB')}` : 'Not opened yet'}>
                                        {r.opened ? (
                                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                            <Eye size={10} /> {r.openCount || 1}
                                          </span>
                                        ) : <span className="text-slate-300">—</span>}
                                      </td>
                                      <td className="px-2 py-1" title={r.firstClickedAt ? `First clicked ${new Date(r.firstClickedAt).toLocaleString('en-GB')}` : 'No clicks yet'}>
                                        {r.clicked ? (
                                          <span className="inline-flex items-center gap-1 text-indigo-700 font-bold">
                                            <MousePointerClick size={10} /> {r.clickCount || 1}
                                          </span>
                                        ) : <span className="text-slate-300">—</span>}
                                      </td>
                                      <td className="px-2 py-1 text-slate-500 truncate max-w-[320px]" title={r.error || r.sentAt}>
                                        {r.error || (r.sentAt ? new Date(r.sentAt).toLocaleString('en-GB') : '—')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-indigo-600" />
                <h3 className="text-sm font-black text-slate-800">Preview</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  with sample recipient {sampleCtx.email}
                </span>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <XIcon size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Subject</div>
              <div className="text-sm font-bold text-slate-800 mb-4 px-3 py-2 bg-slate-50 rounded-lg">
                {previewTokens(subject || '(no subject)', sampleCtx)}
              </div>
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Body</div>
              <div className="border border-slate-200 rounded-lg p-4 bg-white prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewTokens(bodyHtml || '<p>(empty body)</p>', sampleCtx) }} />
              {attachments.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 inline-flex items-center gap-1">
                    <Paperclip size={11} /> Attachments · {attachments.length} · {formatBytes(attachmentTotal)}
                  </div>
                  <ul className="space-y-1">
                    {attachments.map((a, i) => (
                      <li key={`prev-${a.filename}-${i}`}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                        <Paperclip size={11} className="text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-700 truncate flex-1" title={a.filename}>{a.filename}</span>
                        <span className="text-slate-400 shrink-0">{formatBytes(a.size)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                + Unsubscribe link will be appended automatically
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
