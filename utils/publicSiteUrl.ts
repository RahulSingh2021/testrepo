// Returns the canonical public site origin used in links shared
// outside the app (WhatsApp messages, emails, copy-link buttons).
//
// Recipients of these links are typically not signed-in admins on
// the dev/preview deployment — they should land on the production
// site (https://haccppro.in by default) so they can view the shared
// observation AND optionally browse the rest of the site afterwards.
//
// Resolution order:
//   1. NEXT_PUBLIC_APP_URL (env override, e.g. when self-hosting)
//   2. https://haccppro.in (the registered production domain)
//
// We deliberately do NOT use window.location.origin here — when the
// admin is on a Replit preview URL, sharing that URL externally would
// give the recipient a broken / auth-gated link.
export function getPublicSiteUrl(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (env) return env;
  return 'https://haccppro.in';
}
