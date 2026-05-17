// Server-side helper for the "public-only mirror" mode.
//
// The HACCP PRO deployment can serve more than one custom domain. Any
// host listed in the PUBLIC_ONLY_HOSTS env var is treated as a
// public-only mirror: visitors see only the public landing page (the
// same screen a signed-out visitor sees on haccppro.in), and every
// authenticated surface (login form, /admin, /api/auth/*, etc.) is
// blocked at the edge.
//
// The primary domain (haccppro.in) keeps the full app — login, admin,
// dashboard — exactly as before.
//
// Env format:
//   PUBLIC_ONLY_HOSTS="brand2.com,www.brand2.com"
// Hostnames are matched case-insensitively and the leading "www." is
// optional. Add or remove a host without redeploying by editing the
// secret and restarting the workflow.

export const PUBLIC_ONLY_HEADER = 'x-haccp-public-only';
export const PUBLIC_ONLY_COOKIE = 'haccp_public_only';

export function getPublicOnlyHosts(): string[] {
  const raw = (process.env.PUBLIC_ONLY_HOSTS || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(host: string | null | undefined): string {
  if (!host) return '';
  // Strip the port (":3000") before comparing.
  return host.toLowerCase().split(':')[0].trim();
}

export function isPublicOnlyHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  const list = getPublicOnlyHosts();
  if (list.length === 0) return false;
  // Match the host directly OR with the optional leading "www." stripped
  // — most operators configure both apex and www.
  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith('www.')) candidates.add(normalized.slice(4));
  for (const h of list) {
    if (candidates.has(h)) return true;
    if (h.startsWith('www.') && candidates.has(h.slice(4))) return true;
  }
  return false;
}
