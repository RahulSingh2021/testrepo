import { headers } from 'next/headers';
import { isPublicOnlyHost, PUBLIC_ONLY_HEADER } from '@/lib/publicOnlyHosts';

// Server-side helper: returns true when the current request is on a
// public-only mirror host. Uses the header tagged by middleware first,
// with a defensive Host re-check for any path that bypasses
// middleware. Public page server components call this and pass the
// boolean down as `initialPublicOnly` so the mirror flag is baked
// into the SSR HTML — sign-in CTAs are then hidden on first paint
// rather than after a client-side cookie read.
export async function getServerIsPublicOnly(): Promise<boolean> {
  const h = await headers();
  if (h.get(PUBLIC_ONLY_HEADER) === '1') return true;
  return isPublicOnlyHost(h.get('host'));
}
