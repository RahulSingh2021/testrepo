import DOMPurify from 'isomorphic-dompurify';
import { normalizeHtmlImageSources } from './normalizeImageUrl';

// Shared allowlist-based sanitizer for news / tips article body HTML.
// Used both server-side (on save in /api/academy/news-posts and
// /api/academy/safety-tips) and client-side (on render in the public
// reader pages) so a malicious draft — e.g. from a compromised admin
// account or a future less-trusted author — can't ship <script>,
// event handlers or other XSS payloads to public visitors. Mirrors
// the allowlist used by the academy lesson renderer.
//
// As a second pass we also rewrite any Google Drive sharing URLs
// pasted into <img src> attributes into a form browsers can actually
// embed, so authors can drop a "share link" into the rich-text
// editor and have it Just Work.

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
  'details', 'summary',
  'mark', 'abbr',
  'dl', 'dt', 'dd',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'style',
  'target', 'rel',
  'width', 'height',
  'colspan', 'rowspan',
  'id',
];

const FORBID_TAGS = [
  'script', 'iframe', 'object', 'embed',
  'form', 'input', 'textarea', 'select', 'button',
  'svg', 'math',
];

const FORBID_ATTR = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
];

export function sanitizeNewsHtml(html: unknown): string {
  if (typeof html !== 'string' || !html) return '';
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS,
    FORBID_ATTR,
  });
  return normalizeHtmlImageSources(cleaned);
}
