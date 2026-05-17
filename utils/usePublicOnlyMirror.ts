'use client';

import { useEffect, useState } from 'react';
import { PUBLIC_ONLY_COOKIE } from '@/lib/publicOnlyHosts';

// Client-side hook that returns true when the current request was
// served on a public-only mirror domain.
//
// Two inputs:
//   1. `initial` — set by the parent page (server component) from
//      the x-haccp-public-only header tagged by middleware. This
//      means the FIRST render of a client component already knows
//      it's on the mirror, so SSR HTML never includes sign-in CTAs.
//   2. The `haccp_public_only=1` cookie set by middleware on every
//      mirror request. Read after hydration as a fallback / sanity
//      check (and so client-side navigations between mirror routes
//      stay correct even if a server prop wasn't passed).
//
// The cookie is cleared on the primary domain by middleware.
export function usePublicOnlyMirror(initial: boolean = false): boolean {
  const [isMirror, setIsMirror] = useState(initial);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const has = document.cookie
      .split(';')
      .some((c) => c.trim().startsWith(`${PUBLIC_ONLY_COOKIE}=1`));
    if (has !== isMirror) setIsMirror(has);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return isMirror;
}
