'use client';

// Client island for the share-landing page action row.
// Renders two buttons:
//   1. "Open article" — primary CTA, opens the original publisher
//      URL. Mirrors the previous server-rendered <a> so visitors
//      who don't want to wait for the auto-redirect can leave
//      immediately.
//   2. "Copy link" — copies the *short* HACCP PRO share URL
//      (window.location.href) to the clipboard so the visitor
//      can re-share the same branded short link instead of the
//      raw publisher URL. Falls back to a hidden textarea +
//      execCommand when the async clipboard API isn't available
//      (e.g. older WebViews, non-https origins).

import { useState } from 'react';

interface ShareActionsProps {
  dest: string;
}

export default function ShareActions({ dest }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      // fall through to legacy path
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginTop: 4,
      }}
    >
      <a
        href={dest}
        rel="nofollow noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 22px',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          color: '#ffffff',
          fontWeight: 700,
          borderRadius: 14,
          textDecoration: 'none',
          fontSize: 14,
          boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
        }}
      >
        Open article →
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-live="polite"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 22px',
          background: copied ? '#ecfdf5' : '#ffffff',
          color: copied ? '#047857' : '#4f46e5',
          fontWeight: 700,
          borderRadius: 14,
          fontSize: 14,
          cursor: 'pointer',
          border: `2px solid ${copied ? '#a7f3d0' : '#e0e7ff'}`,
          transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
        }}
      >
        {copied ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Link copied
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  );
}
