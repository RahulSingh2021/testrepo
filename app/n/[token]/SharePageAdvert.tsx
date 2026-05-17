'use client';

// Drives the share-landing advertising flow:
//   1. Auto-opens the FloatingCourses popup so visitors see the
//      training-courses pitch the moment they land.
//   2. Redirects them to the original article only AFTER they
//      dismiss the popup, OR after a generous safety timeout
//      (15s) so a passive reader still gets the article.
//   3. Cancels the timeout if the component unmounts (e.g. the
//      visitor clicked a course Link inside the panel and is
//      already navigating away).

import { useEffect, useRef } from 'react';
import FloatingCourses from '@/components/FloatingCourses';

interface SharePageAdvertProps {
  dest: string;
  // Maximum time we'll wait before redirecting if the user neither
  // dismisses the popup nor clicks a course. Defaults to 5s so the
  // reader is sent to the article quickly without feeling stuck on
  // the share-landing page.
  maxWaitMs?: number;
}

export default function SharePageAdvert({
  dest,
  maxWaitMs = 5000,
}: SharePageAdvertProps) {
  const firedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const fireRedirect = () => {
    if (firedRef.current) return;
    if (!dest) return;
    firedRef.current = true;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      window.location.replace(dest);
    } catch {
      window.location.href = dest;
    }
  };

  useEffect(() => {
    if (!dest) return;
    timerRef.current = window.setTimeout(fireRedirect, maxWaitMs);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest, maxWaitMs]);

  return (
    <FloatingCourses
      autoOpen
      hideFabAfterDismiss
      onDismiss={fireRedirect}
      // Surface the countdown inside the popup so visitors know
      // when they'll be sent to the article — keeps the popup
      // honest about the wait instead of feeling like a trap.
      redirectInMs={maxWaitMs}
    />
  );
}
