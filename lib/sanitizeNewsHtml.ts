import { normalizeHtmlImageSources } from './normalizeImageUrl';

// Regex-based server-safe HTML sanitizer — no jsdom/DOMPurify dependency
// so it works in Next.js server components without ESM issues.
// Strips dangerous tags and attributes while preserving safe markup.

const FORBIDDEN_TAGS = /(<\s*\/?(script|iframe|object|embed|form|input|textarea|select|button|svg|math|style|link|meta|base)[^>]*>)/gi;
const FORBIDDEN_ATTR = /\s*(onerror|onload|onclick|onmouseover|onfocus|onblur|onchange|onsubmit|javascript)[^=]*=\s*["'][^"']*["']/gi;
const FORBIDDEN_HREF = /href\s*=\s*["']\s*javascript:[^"']*/gi;

export function sanitizeNewsHtml(html: unknown): string {
  if (typeof html !== 'string' || !html) return '';
  const cleaned = html
    .replace(FORBIDDEN_TAGS, '')
    .replace(FORBIDDEN_ATTR, '')
    .replace(FORBIDDEN_HREF, 'href="#"');
  return normalizeHtmlImageSources(cleaned);
}
