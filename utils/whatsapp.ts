import type React from 'react';

// Open WhatsApp directly in the WhatsApp Desktop / mobile app via the
// `whatsapp://send` protocol handler. Using the app means clicks instantly
// switch chats inside the same app window without ever opening a new browser
// tab.
//
// Why not reuse a WhatsApp Web tab? `web.whatsapp.com` sends a
// `Cross-Origin-Opener-Policy: same-origin` header that severs the named-tab
// link the moment WhatsApp Web finishes loading, after which the browser has
// no choice but to spawn a fresh tab on every subsequent click. There is no
// JS workaround for that.
//
// Fallback: if the user doesn't have WhatsApp Desktop installed (the protocol
// handler will quietly do nothing), we open `wa.me` after a short delay so
// they still land in WhatsApp Web instead of nothing happening at all.
export const openWhatsApp = (
  urlOrPhone: string | null | undefined,
  e?: React.MouseEvent,
  prefilledText?: string,
) => {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (!urlOrPhone) return;
  let phone = '';
  let text = prefilledText || '';
  try {
    const u = new URL(urlOrPhone, typeof window !== 'undefined' ? window.location.href : 'https://x/');
    phone = (u.searchParams.get('phone') || u.pathname.replace(/^\//, '')).replace(/\D+/g, '');
    if (!text) text = u.searchParams.get('text') || '';
  } catch {
    phone = (urlOrPhone.match(/\d+/g)?.join('') || '');
  }
  if (!phone) return;
  const appUrl = `whatsapp://send?phone=${phone}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
  const webUrl = `https://web.whatsapp.com/send?phone=${phone}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appUrl;
    document.body.appendChild(iframe);
    const fallbackTimer = window.setTimeout(() => {
      window.open(webUrl, 'whatsapp_web');
    }, 1200);
    const onBlur = () => { window.clearTimeout(fallbackTimer); };
    window.addEventListener('blur', onBlur, { once: true });
    window.setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      try { iframe.remove(); } catch {}
    }, 1500);
  } catch {
    if (typeof window !== 'undefined') window.location.href = appUrl;
  }
};
