"use client";

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, MessageCircle, Copy, Check, Send } from 'lucide-react';
import { getEscalationContactsForResponsibility, type EscalationContact } from '../utils/escalationContacts';

export type ConfirmObservationSummary = {
  responsibility: string;
  questionText: string;
  observationText: string;
  location?: string;
  selectedAnswer?: string;
  sectionTitle?: string;
  // Fields used to mirror the registry's mobile-share message format.
  id?: string;
  title?: string;
  status?: string;
  severity?: string;
  hierarchy?: string;
  mainKitchen?: string;
  sop?: string;
  reportedBy?: string;
  createdDate?: string;
  duration?: string;
  followUpCount?: number;
  images?: string[];
  kind?: 'new' | 'followup';
};

type Props = {
  observations: ConfirmObservationSummary[];
  unitName?: string;
  auditorName?: string;
  onDone: (result: { skipped: boolean; sent: number; missingPhone: boolean }) => void;
};

const formatStatus = (status?: string): { emoji: string; label: string } => {
  const s = (status || 'OPEN').toUpperCase();
  if (s === 'RESOLVED') return { emoji: '✅', label: 'Resolved' };
  if (s === 'OPEN') return { emoji: '🔴', label: 'Open' };
  return { emoji: '🔵', label: 'In Progress' };
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const formatCreatedDate = (iso?: string): string => {
  if (!iso) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const buildSingleObservationMessage = (o: ConfirmObservationSummary): string => {
  const status = formatStatus(o.status);
  const severity = o.severity ? titleCase(o.severity) : 'Minor';
  const locationName = o.location || o.mainKitchen || '';
  const responsibility = o.responsibility || '';
  const locationLine = locationName ? `📍 *Location:* ${locationName}` : '';
  const responsibilityLine = responsibility ? `🧑‍💼 *Responsibility:* ${responsibility}` : '';
  const sopFormatted = o.sop ? o.sop.replace(/\s*>\s*/g, ' → ') : '';

  // Follow-up alert variant — fired when the X (Not Done) button is clicked on an open observation.
  if (o.kind === 'followup') {
    const followUpNum = typeof o.followUpCount === 'number' ? o.followUpCount : 1;
    const lines: string[] = [];
    lines.push('⏰ *Follow-up Alert: Pending Observation*');
    lines.push(`${status.emoji} *Status:* ${status.label} | ⚠️ *Severity:* ${severity}  `);
    lines.push('');
    lines.push(`🔄 *Follow-up #${followUpNum}*`);
    if (o.observationText) lines.push(`🗒️ *Observation:* ${o.observationText}  `);
    if (locationLine) lines.push(`${locationLine}  `);
    if (responsibilityLine) lines.push(`${responsibilityLine}  `);
    lines.push('');
    lines.push(`📅 *Reported On:* ${formatCreatedDate(o.createdDate)}  `);
    lines.push('');
    lines.push('👉 *Action Required:* Pending closure. Please take corrective action and update status immediately.');
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push('🚨 *Audit Observation Alert*');
  lines.push('');
  if (o.observationText) lines.push(`🗒️ *Observation:* ${o.observationText}  `);
  if (locationLine) lines.push(`${locationLine}  `);
  if (responsibilityLine) lines.push(`${responsibilityLine}  `);
  lines.push('');
  lines.push(`${status.emoji} *Status:* ${status.label} | ⚠️ *Severity:* ${severity}  `);
  lines.push('');
  if (sopFormatted) lines.push(`📝 *SOP:* ${sopFormatted}  `);
  if (o.reportedBy) lines.push(`👤 *Reported By:* ${o.reportedBy}  `);
  lines.push(`📅 *Date:* ${formatCreatedDate(o.createdDate)}  `);
  if (typeof o.followUpCount === 'number') lines.push(`🔄 *Follow-ups:* ${o.followUpCount}  `);
  lines.push('');
  lines.push('👉 *Action Required:* Please take corrective action and update status.');
  return lines.join('\n');
};

const buildDefaultMessage = (
  obs: ConfirmObservationSummary[],
  _unitName?: string,
  _auditorName?: string,
): string => {
  if (obs.length === 0) return '';
  if (obs.length === 1) return buildSingleObservationMessage(obs[0]);
  return obs.map((o, i) => `(${i + 1}/${obs.length})\n${buildSingleObservationMessage(o)}`).join('\n\n―――\n\n');
};

const WhatsAppObservationConfirm: React.FC<Props> = ({ observations, unitName, auditorName, onDone }) => {
  const initialMessage = useMemo(
    () => buildDefaultMessage(observations, unitName, auditorName),
    [observations, unitName, auditorName],
  );
  const [message, setMessage] = useState(initialMessage);
  const [copied, setCopied] = useState(false);
  const [apiSending, setApiSending] = useState<string | null>(null); // phone currently sending
  const [apiResult, setApiResult] = useState<{ phone: string; ok: boolean; msg: string } | null>(null);

  const recipientHints = useMemo(() => {
    const set = new Set<string>();
    observations.forEach((o) => { if (o.responsibility) set.add(o.responsibility); });
    return Array.from(set);
  }, [observations]);

  // Department Contacts tab was removed — Escalation Matrix is the single
  // source of truth for routing. Keeping an empty array preserves downstream
  // render code that still references mappedContacts without further changes.
  const mappedContacts = useMemo(() => [] as { responsibility: string; name: string; phone: string }[], []);

  // Pull every user enrolled in the Escalation Matrix for this observation's
  // responsibility/department. Lets the operator fire the WhatsApp template to
  // any escalation tier (L1 first responder, L2 supervisor, L3 head) directly,
  // not just the single default contact above.
  const escalationContacts = useMemo(() => {
    const seen = new Set<string>();
    const out: (EscalationContact & { responsibility: string })[] = [];
    recipientHints.forEach((resp) => {
      getEscalationContactsForResponsibility(resp).forEach((c) => {
        if (seen.has(c.userId)) return;
        seen.add(c.userId);
        out.push({ ...c, responsibility: resp });
      });
    });
    return out;
  }, [recipientHints]);

  const handleDirectSend = (phone: string) => {
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    closeAfter(true);
  };

  // Fire the message through Meta WhatsApp Cloud API. Server route maps
  // each observation onto the approved template (haccp_new_observation or
  // haccp_observation_followup) and POSTs to graph.facebook.com.
  const handleCloudApiSend = async (phone: string) => {
    if (apiSending) return;
    setApiSending(phone);
    setApiResult(null);
    let okCount = 0;
    let firstErr = '';
    try {
      // One template message per observation — Meta templates are 1:1 with
      // a single observation's fields. If multiple observations are bundled,
      // we send N messages back-to-back.
      for (const o of observations) {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            kind: o.kind === 'followup' ? 'followup' : 'new',
            observation: {
              observationText: o.observationText,
              location: o.location,
              mainKitchen: o.mainKitchen,
              responsibility: o.responsibility,
              status: o.status,
              severity: o.severity,
              sop: o.sop,
              reportedBy: o.reportedBy,
              createdDate: o.createdDate,
              followUpCount: o.followUpCount,
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          okCount += 1;
        } else if (!firstErr) {
          firstErr = data?.error || `HTTP ${res.status}`;
          if (data?.hint) firstErr += ` — ${data.hint}`;
        }
      }
    } catch (err: any) {
      firstErr = err?.message || 'Network error';
    } finally {
      setApiSending(null);
    }

    if (okCount > 0 && !firstErr) {
      setApiResult({ phone, ok: true, msg: `Sent ${okCount} message${okCount > 1 ? 's' : ''} via WhatsApp Cloud API` });
      setTimeout(() => closeAfter(true), 1200);
    } else if (okCount > 0) {
      setApiResult({ phone, ok: false, msg: `Sent ${okCount}, but one failed: ${firstErr}` });
    } else {
      setApiResult({ phone, ok: false, msg: firstErr || 'Send failed' });
    }
  };

  const allImages = useMemo(() => {
    const out: { url: string; obsId?: string }[] = [];
    observations.forEach((o) => {
      (o.images || []).forEach((u) => { if (u) out.push({ url: u, obsId: o.id }); });
    });
    return out;
  }, [observations]);
  const [includeImages, setIncludeImages] = useState(true);

  const dataUrlToBlob = (dataUrl: string): Blob | null => {
    try {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl);
      if (!m) return null;
      const mime = (m[1] || 'image/jpeg').toLowerCase();
      const isB64 = !!m[2];
      const data = m[3] || '';
      let bytes: Uint8Array;
      if (isB64) {
        const bin = atob(data);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        const decoded = decodeURIComponent(data);
        bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  };

  const loadImage = (sourceUrl: string): Promise<HTMLImageElement | null> => {
    if (!sourceUrl) return Promise.resolve(null);
    const tryLoad = (withCors: boolean) => new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      // Only request CORS for remote URLs — setting it on data:/blob: can fail
      // on some Android browsers and trigger onerror with no useful message.
      if (withCors && !/^(data:|blob:)/i.test(sourceUrl)) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
      img.onerror = () => resolve(null);
      img.src = sourceUrl;
    });
    return tryLoad(true).then((r) => r || tryLoad(false));
  };

  // Strip WhatsApp formatting markers (*bold*, trailing soft-break spaces) so the
  // caption looks clean when drawn onto the canvas.
  const stripFormatting = (text: string): string => {
    return text
      .split('\n')
      .map((line) => line.replace(/\*([^*\n]+)\*/g, '$1').replace(/\s+$/g, ''))
      .join('\n');
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const out: string[] = [];
    text.split('\n').forEach((paragraph) => {
      if (!paragraph) { out.push(''); return; }
      const words = paragraph.split(' ');
      let current = '';
      words.forEach((w) => {
        const test = current ? `${current} ${w}` : w;
        if (ctx.measureText(test).width <= maxWidth) {
          current = test;
        } else {
          if (current) out.push(current);
          // Single very-long word — hard break char-by-char.
          if (ctx.measureText(w).width > maxWidth) {
            let chunk = '';
            for (const ch of w) {
              if (ctx.measureText(chunk + ch).width <= maxWidth) chunk += ch;
              else { out.push(chunk); chunk = ch; }
            }
            current = chunk;
          } else {
            current = w;
          }
        }
      });
      if (current) out.push(current);
    });
    return out;
  };

  // Bake "photo + caption underneath" into a single JPEG. Works identically on
  // mobile and desktop because the caption is no longer separate text.
  const buildPhotoWithCaption = async (sourceUrl: string, caption: string): Promise<Blob | null> => {
    const img = await loadImage(sourceUrl);
    const canvasWidth = 1080;
    const padding = 32;
    const lineHeight = 30;
    const fontSize = 22;
    const headerHeight = 60;

    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return null;
    probe.font = `${fontSize}px -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    const lines = wrapText(probe, stripFormatting(caption), canvasWidth - padding * 2);
    const captionHeight = padding + lines.length * lineHeight + padding;

    // Fit the photo inside a bounded box so portrait pictures don't make
    // the composite hugely tall. Landscape photos fill the canvas width;
    // portrait photos are scaled down to fit the height cap, leaving white
    // margins on the sides — same approach as object-fit: contain.
    let imgDrawW = 0;
    let imgDrawH = 0;
    const maxImgW = canvasWidth;
    const maxImgH = 900;
    if (img) {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      if (naturalW && naturalH) {
        const scale = Math.min(maxImgW / naturalW, maxImgH / naturalH, 1);
        imgDrawW = Math.round(naturalW * scale);
        imgDrawH = Math.round(naturalH * scale);
      }
    }

    const canvasHeight = headerHeight + (imgDrawH || 0) + captionHeight;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Header band (brand strip).
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasWidth, headerHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText('HACCP PRO · Audit Observation', padding, headerHeight / 2);

    // Image.
    if (img && imgDrawH > 0) {
      const xOffset = Math.round((canvasWidth - imgDrawW) / 2);
      ctx.drawImage(img, xOffset, headerHeight, imgDrawW, imgDrawH);
    }

    // Caption block.
    const captionTop = headerHeight + (imgDrawH || 0);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, captionTop, canvasWidth, captionHeight);
    ctx.fillStyle = '#0f172a';
    ctx.font = `${fontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    lines.forEach((ln, i) => {
      ctx.fillText(ln, padding, captionTop + padding + i * lineHeight);
    });

    // Try toBlob first, fall back to toDataURL → Blob (some Android Chromium
    // builds silently return null from toBlob for tall canvases).
    return new Promise<Blob | null>((resolve) => {
      let settled = false;
      const finish = (b: Blob | null) => { if (!settled) { settled = true; resolve(b); } };
      try {
        canvas.toBlob(
          (b) => {
            if (b && b.size > 0) { finish(b); return; }
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              finish(dataUrlToBlob(dataUrl));
            } catch { finish(null); }
          },
          'image/jpeg',
          0.9,
        );
      } catch {
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          finish(dataUrlToBlob(dataUrl));
        } catch { finish(null); }
      }
      // Safety net: if toBlob never calls back (rare Android bug), fall through.
      window.setTimeout(() => {
        if (!settled) {
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            finish(dataUrlToBlob(dataUrl));
          } catch { finish(null); }
        }
      }, 1500);
    });
  };

  const buildCaptionOnlyImage = async (caption: string): Promise<Blob | null> => {
    return buildPhotoWithCaption('', caption);
  };

  const urlToFile = async (url: string, fallbackName: string): Promise<File | null> => {
    try {
      const blob = await buildPhotoWithCaption(url, message);
      // Reject any blob smaller than 1KB — JPEG headers alone are larger than
      // that, so anything tinier means the encoder failed and would trigger
      // WhatsApp's "Can't send empty message" toast.
      if (!blob || blob.size < 1024) return null;
      return new File([blob], `${fallbackName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    } catch {
      return null;
    }
  };

  const buildCaptionOnlyFile = async (): Promise<File | null> => {
    try {
      const blob = await buildPhotoWithCaption('', message);
      if (!blob || blob.size < 1024) return null;
      return new File([blob], `observation-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    } catch {
      return null;
    }
  };

  const collectFiles = async (): Promise<File[]> => {
    const files: File[] = [];
    if (includeImages && allImages.length > 0) {
      for (let i = 0; i < allImages.length; i++) {
        const f = await urlToFile(allImages[i].url, `evidence-${allImages[i].obsId || 'obs'}-${i + 1}`);
        if (f) files.push(f);
      }
    }
    // If we ended up with zero shareable files (no photos selected, or every
    // photo failed to decode), still produce a caption-only image so the
    // share never goes out empty.
    if (files.length === 0) {
      const fallback = await buildCaptionOnlyFile();
      if (fallback) files.push(fallback);
    }
    return files;
  };

  const closeAfter = (sent: boolean) => {
    onDone({ skipped: !sent, sent: sent ? 1 : 0, missingPhone: false });
  };

  const [busy, setBusy] = useState(false);

  const safeCopyToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
    } catch {
      // Best-effort; ignore failures (e.g. permissions blocked).
    }
  };

  const downloadFile = (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      // Ignore — best-effort fallback.
    }
  };

  const isMobileDevice = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  // True when the page is running as an installed PWA (standalone display
  // mode). PWAs on Android pass shared files to other apps as `content://`
  // URIs that don't always carry read permission, which shows up as
  // "Can't send empty message" in WhatsApp. We work around this by saving
  // the image to the device and letting the user attach it manually.
  const isStandalonePwa = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch {}
    // iOS Safari uses a non-standard navigator.standalone flag.
    if ((navigator as any)?.standalone === true) return true;
    return false;
  };

  const handleNativeShare = async () => {
    if (busy) return;
    setBusy(true);
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    const mobile = isMobileDevice();
    let files: File[] = [];
    try {
      files = await collectFiles();
    } catch {
      files = [];
    }

    // Always try the native share sheet first when it can carry files. The
    // composite image already has the full observation text baked into the
    // pixels, AND we additionally pass `text` so the receiving app (WhatsApp,
    // Gmail, etc.) can pre-fill its caption field. This is the same shape
    // the per-card share button used to use, which the user confirmed
    // worked previously — it's the empty-text wa.me/?text= fallback that
    // was producing "Can't send empty message", not this path.
    const sharePayload: any = { title: 'HACCP Observation', text: message };
    if (files.length > 0) sharePayload.files = files;

    // IMPORTANT: do NOT gate on navigator.canShare() — many Android PWA
    // (standalone WebView) builds return canShare()=false for {files} even
    // though navigator.share() actually opens the system share sheet
    // successfully. Gating on canShare causes the share sheet to never
    // appear in PWA mode while it works fine in a mobile browser tab.
    //
    // Ordering matters per environment:
    // - In a standalone PWA on Android, `share({files, text})` often returns
    //   success but the OS silently strips the file (content:// URI grant
    //   fails for the PWA caller), so the receiving app sees only the text
    //   and the user gets a text-only share with no image. To prevent that,
    //   we try files-ONLY first when in PWA — the share intent is then
    //   unambiguously a file share, and the OS cannot fall back to text.
    //   The caption is baked into the image pixels so no info is lost.
    // - In a regular browser tab (mobile or desktop), files+text together
    //   works correctly and gives the user an editable caption in WhatsApp,
    //   so we try the combined payload first there.
    const pwa = isStandalonePwa();
    const orderedAttempts: any[] = [];
    if (files.length > 0) {
      if (pwa) {
        orderedAttempts.push({ title: 'HACCP Observation', files });
        orderedAttempts.push(sharePayload);
      } else {
        orderedAttempts.push(sharePayload);
        orderedAttempts.push({ title: 'HACCP Observation', files });
      }
    }
    orderedAttempts.push({ title: 'HACCP Observation', text: message });

    if (nav?.share) {
      for (const payload of orderedAttempts) {
        try {
          await nav.share(payload);
          setBusy(false);
          closeAfter(true);
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') { setBusy(false); return; }
          // Otherwise continue to the next attempt.
        }
      }
    }

    // Fallback: save the composite image(s) to the device and open WhatsApp.
    // The image carries the full caption as pixels, so the user can simply
    // attach it from their gallery and send — no typing required.
    if (files.length > 0) files.forEach(downloadFile);
    setBusy(false);
    try {
      if (mobile) {
        window.location.href = 'whatsapp://';
      } else {
        window.open('https://web.whatsapp.com/', 'whatsapp_web');
      }
    } catch {}
    closeAfter(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!(navigator as any).share;

  return createPortal(
    <div
      className="fixed inset-0 z-[10018] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      onClick={() => closeAfter(false)}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#25D366] to-[#1da851] text-white">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} />
            <div>
              <div className="font-bold text-sm leading-tight">Share observation on WhatsApp?</div>
              <div className="text-[11px] opacity-90 leading-tight">
                You&apos;ll pick the recipient inside WhatsApp.
              </div>
            </div>
          </div>
          <button
            onClick={() => closeAfter(false)}
            className="p-1 hover:bg-white/20 rounded-full"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {recipientHints.length > 0 && (
            <div className="text-[11px] text-gray-500">
              Suggested recipient{recipientHints.length > 1 ? 's' : ''}:{' '}
              {recipientHints.map((r, i) => (
                <span key={r} className="font-semibold text-gray-700">
                  {r}{i < recipientHints.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}

          {mappedContacts.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-3">
              <div className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Send size={11} /> Send directly to mapped contact
              </div>
              <div className="space-y-2">
                {mappedContacts.map((c) => {
                  const sendingThis = apiSending === c.phone;
                  return (
                    <div key={c.phone + c.responsibility} className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[140px] text-xs">
                        <div className="font-bold text-emerald-900 leading-tight">{c.name}</div>
                        <div className="font-mono text-[10px] text-emerald-700/70">+{c.phone}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDirectSend(c.phone)}
                        disabled={sendingThis}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold shadow-sm transition-colors disabled:opacity-50"
                        title="Opens WhatsApp app/web with the message pre-filled — you tap Send"
                      >
                        <MessageCircle size={12} /> Open Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloudApiSend(c.phone)}
                        disabled={!!apiSending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-lg text-[11px] font-bold shadow-sm transition-colors disabled:opacity-60"
                        title="Sends instantly via Meta WhatsApp Cloud API using the approved observation template"
                      >
                        <Send size={12} /> {sendingThis ? 'Sending…' : 'Send via API'}
                      </button>
                    </div>
                  );
                })}
              </div>
              {apiResult && (
                <div
                  className={`text-[10px] font-bold mt-2 px-2 py-1.5 rounded-md leading-snug ${
                    apiResult.ok
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {apiResult.ok ? '✅ ' : '⚠️ '}
                  {apiResult.msg}
                </div>
              )}
              <p className="text-[10px] text-emerald-700/70 mt-2 leading-snug">
                <b>Open Chat</b> launches WhatsApp with text pre-filled (you still tap send).
                <b> Send via API</b> delivers the approved template instantly through Meta — no app open.
              </p>
            </div>
          )}

          {escalationContacts.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-3">
              <div className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Send size={11} /> Escalation Matrix · {escalationContacts.length} {escalationContacts.length === 1 ? 'member' : 'members'}
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {escalationContacts.map((c) => {
                  const sendingThis = apiSending === c.phone;
                  const levelColor =
                    c.level === 1
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : c.level === 2
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200';
                  return (
                    <div key={c.userId} className="flex flex-wrap items-center gap-2 bg-white/60 rounded-lg px-2 py-1.5">
                      <div className="flex-1 min-w-[140px] text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${levelColor}`}>L{c.level}</span>
                          <span className="font-bold text-indigo-900 leading-tight truncate">{c.name}</span>
                        </div>
                        <div className="font-mono text-[10px] text-indigo-700/70 mt-0.5">+{c.phone} · {c.group}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDirectSend(c.phone)}
                        disabled={sendingThis}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50"
                        title="Opens WhatsApp app/web with the message pre-filled"
                      >
                        <MessageCircle size={11} /> Open Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloudApiSend(c.phone)}
                        disabled={!!apiSending}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#25D366] hover:bg-[#1da851] text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors disabled:opacity-60"
                        title="Sends instantly via Meta WhatsApp Cloud API"
                      >
                        <Send size={11} /> {sendingThis ? 'Sending…' : 'Send via API'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-indigo-700/70 mt-2 leading-snug">
                Pulled live from <b>Escalation Matrix</b>. Members are sorted by level (L1 = first responder).
                Only users with a phone on file are shown.
              </p>
            </div>
          )}

          {mappedContacts.length === 0 && escalationContacts.length === 0 && recipientHints.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-snug">
              <b>No mapped contacts found</b> for {recipientHints.join(', ')}. Enroll users in
              the <b>Escalation Matrix</b> with phone numbers, then this panel will show one-tap send buttons.
            </div>
          )}

          <label className="block">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Message (editable)
              </span>
              <button
                onClick={handleCopy}
                className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                type="button"
              >
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={11}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 font-mono leading-snug focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] outline-none resize-y"
            />
          </label>
          <p className="text-[10px] text-gray-400">
            This text is <b>baked into the image</b> below the photo — nothing is sent as a separate
            caption. Edit it here before sharing if you want.
          </p>

          {allImages.length > 0 && (
            <div className="border-t pt-3">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="w-4 h-4 accent-[#25D366]"
                />
                <span className="text-xs font-bold text-gray-700">
                  Attach {allImages.length} photo{allImages.length > 1 ? 's' : ''} of evidence
                </span>
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <img
                    key={i}
                    src={img.url}
                    alt={`Evidence ${i + 1}`}
                    className={`h-16 w-16 object-cover rounded-md border shrink-0 ${includeImages ? '' : 'opacity-30 grayscale'}`}
                  />
                ))}
              </div>
              <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 mt-1.5 leading-snug">
                <b>The caption is baked into the image</b> — so it can never be lost. On
                mobile, tap <b>Share</b> → pick WhatsApp → pick contact. On desktop, the
                image{allImages.length > 1 ? 's' : ''} download to your computer; just drag
                {' '}{allImages.length > 1 ? 'them' : 'it'} into any WhatsApp Web chat.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
          <button
            onClick={() => closeAfter(false)}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Skip
          </button>
          {hasNativeShare ? (
            <button
              onClick={handleNativeShare}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#25D366] hover:bg-[#1da851] flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <Share2 size={13} /> {busy ? 'Preparing…' : 'Share'}
            </button>
          ) : (
            <button
              onClick={handleNativeShare}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#25D366] hover:bg-[#1da851] flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <Share2 size={13} /> {busy ? 'Preparing…' : 'Open WhatsApp'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WhatsAppObservationConfirm;
