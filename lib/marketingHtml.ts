import DOMPurify from 'isomorphic-dompurify';

// ── Bulk-marketing HTML utilities ───────────────────────────────────────────
// Shared by the composer (server-side sanitise on save) and the sender
// (token expansion + unsubscribe-footer injection per recipient).

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'a',
  'b', 'strong', 'i', 'em', 'u', 's', 'del', 'sub', 'sup',
  'blockquote', 'pre', 'code',
  'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  'img', 'figure', 'figcaption',
  'mark', 'abbr',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'style',
  'target', 'rel',
  'width', 'height',
  'colspan', 'rowspan',
];

const FORBID_TAGS = [
  'script', 'iframe', 'object', 'embed',
  'form', 'input', 'textarea', 'select', 'button',
  'svg', 'math', 'link', 'meta', 'style',
];

const FORBID_ATTR = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
  'onmouseout', 'onsubmit', 'onchange',
];

export function sanitizeMarketingHtml(html: unknown): string {
  if (typeof html !== 'string' || !html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS,
    FORBID_ATTR,
  });
}

export interface MergeContext {
  name?: string;
  title?: string;
  organisation?: string;
  email?: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));

// First non-empty value with a sensible fallback.
const pick = (...vals: Array<string | undefined>): string => {
  for (const v of vals) if (v && String(v).trim()) return String(v).trim();
  return '';
};

// Replaces {{name}} / {{title}} / {{organisation}} (and {{email}}) tokens
// in the given HTML. Empty values fall back so the rendered email never
// shows a literal "Hi ," or an awkward dangling token.
export function expandMergeTokens(html: string, ctx: MergeContext): string {
  const name = pick(ctx.name) || 'there';
  const title = pick(ctx.title) || '';
  const organisation = pick(ctx.organisation) || '';
  const email = pick(ctx.email) || '';
  const map: Record<string, string> = {
    name: escapeHtml(name),
    title: escapeHtml(title),
    organisation: escapeHtml(organisation),
    organization: escapeHtml(organisation),
    email: escapeHtml(email),
  };
  return html.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_full, key: string) => {
    const k = String(key || '').toLowerCase();
    if (k in map) return map[k];
    return '';
  });
}

// ── Engagement tracking (opens + clicks) ───────────────────────────────────
// The send loop personalises every email body per recipient. After token
// expansion we rewrite every external <a href> to a /api/marketing-track/click
// proxy URL (which 302-redirects to the original target) and append a 1×1
// tracking pixel that hits /api/marketing-track/open on first render.
//
// The unsubscribe footer is appended AFTER rewriteLinksForTracking + the
// pixel, so the unsubscribe URL itself is never proxied — we don't want to
// log "click" events for someone opting out.

interface TrackingCtx {
  trackingBaseUrl: string; // e.g. https://app.example.com (no trailing /)
  campaignId: string;
  recipientId: string;
}

const buildTrackUrl = (base: string, kind: 'open' | 'click', ctx: TrackingCtx, originalUrl?: string): string => {
  const c = encodeURIComponent(ctx.campaignId);
  const r = encodeURIComponent(ctx.recipientId);
  const baseUrl = `${base}/api/marketing-track/${kind}?c=${c}&r=${r}`;
  if (kind === 'click' && originalUrl) return `${baseUrl}&u=${encodeURIComponent(originalUrl)}`;
  return baseUrl;
};

// Rewrites every http(s) <a href="..."> in the supplied HTML to a
// click-tracking proxy URL. Non-http schemes (mailto:, tel:, #anchors,
// javascript:, cid:) are left untouched so they keep working in the
// recipient's mail client. Existing query strings on the original URL are
// preserved because we encode the whole URL into the `u` parameter.
export function rewriteLinksForTracking(html: string, ctx: TrackingCtx): string {
  if (!html) return html;
  return html.replace(/<a\b([^>]*?)href\s*=\s*("([^"]*)"|'([^']*)')([^>]*)>/gi,
    (full, pre: string, _q: string, dq: string | undefined, sq: string | undefined, post: string) => {
      const original = (dq ?? sq ?? '').trim();
      if (!/^https?:\/\//i.test(original)) return full;
      const tracked = buildTrackUrl(ctx.trackingBaseUrl, 'click', ctx, original);
      return `<a${pre}href="${escapeHtml(tracked)}"${post}>`;
    });
}

// 1×1 transparent tracking pixel. Inlined at the very end of the email
// body (just before the unsubscribe footer) so the recipient's client
// fetches it once when the message is rendered.
export function buildTrackingPixelHtml(ctx: TrackingCtx): string {
  const url = buildTrackUrl(ctx.trackingBaseUrl, 'open', ctx);
  return `<img src="${escapeHtml(url)}" width="1" height="1" style="display:block;border:0;outline:none;height:1px;width:1px" alt="" />`;
}

export function buildUnsubscribeFooterHtml(unsubscribeUrl: string): string {
  const safe = escapeHtml(unsubscribeUrl);
  return `
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px">
<p style="font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;margin:0">
  You're receiving this because you registered for SafeFood Mitra training or were added to our marketing list.<br>
  Don't want these updates? <a href="${safe}" style="color:#4F46E5;text-decoration:underline">Unsubscribe</a>.
</p>`;
}
