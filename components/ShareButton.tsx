'use client';

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  label: string;
  copiedLabel: string;
  className?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
  };
}

function appendUtm(rawUrl: string, utm?: ShareButtonProps['utm']): string {
  if (!utm) return rawUrl;
  const entries: Array<[string, string]> = [];
  if (utm.source) entries.push(['utm_source', utm.source]);
  if (utm.medium) entries.push(['utm_medium', utm.medium]);
  if (utm.campaign) entries.push(['utm_campaign', utm.campaign]);
  if (utm.content) entries.push(['utm_content', utm.content]);
  if (!entries.length) return rawUrl;
  try {
    const u = new URL(rawUrl);
    for (const [k, v] of entries) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    const sep = rawUrl.includes('?') ? '&' : '?';
    const qs = entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${rawUrl}${sep}${qs}`;
  }
}

export default function ShareButton({
  url,
  title,
  text,
  label,
  copiedLabel,
  className,
  utm,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  // We deliberately DO NOT force a synthetic utm_medium ("webshare"
  // / "copy") any more — it bloated every shared URL by ~20 chars
  // without telling us anything the caller's utm.source doesn't
  // already convey, and shorter share URLs render better in WhatsApp,
  // SMS and printed QR codes.
  const handleClick = async () => {
    const finalUrl = appendUtm(url, utm);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url: finalUrl, title, text });
        return;
      } catch {
        /* user dismissed the sheet — fall through to clipboard copy */
      }
    }
    try {
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt(label, finalUrl);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ||
        'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-slate-200 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 font-extrabold text-[11px] uppercase tracking-widest shadow-sm transition-colors'
      }
      title={label}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-emerald-600" /> {copiedLabel}
        </>
      ) : typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
        <>
          <Share2 className="w-4 h-4" /> {label}
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" /> {label}
        </>
      )}
    </button>
  );
}
