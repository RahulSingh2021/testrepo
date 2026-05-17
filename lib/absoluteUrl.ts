import { headers } from 'next/headers';

// Build absolute URLs for server-rendered Open Graph metadata.
// Order of precedence:
//   1. NEXT_PUBLIC_BASE_URL (set explicitly in production)
//   2. Replit's $REPLIT_DEV_DOMAIN (works inside the dev container)
//   3. The current request's x-forwarded-host / host header
//   4. http://localhost:5000 (last-resort dev fallback)
//
// Always returns a value with no trailing slash so callers can
// concat paths cleanly.

// Host-first base URL — opposite precedence from getBaseUrl(). Prefers
// the actual incoming request host so per-host concerns (canonical
// metadata, share links) emit URLs pointing at the host the visitor
// is on. Falls back to the env-based base only when there is no
// request context (e.g. during build).
//
// Use this for any per-request, per-host URL: canonical, og:url, share
// URLs. Keep using getBaseUrl() for build-time / non-request work
// where a stable env-pinned URL is preferred.
export async function getRequestBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  } catch {
    /* headers() can throw outside a request context — fall through */
  }
  return getBaseUrl();
}

export async function getBaseUrl(): Promise<string> {
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  } catch {
    /* headers() can throw outside a request context — fall through */
  }
  return 'http://localhost:5000';
}

export function toAbsoluteUrl(maybeRelative: string | undefined, base: string): string | undefined {
  if (!maybeRelative) return undefined;
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  if (maybeRelative.startsWith('/')) return `${base}${maybeRelative}`;
  return `${base}/${maybeRelative}`;
}
