'use client';

// Floating training-courses widget for the public Food Safety News
// page. Lives as a small FAB pinned to the bottom-right of the
// viewport on every screen (web + mobile). When tapped/clicked it
// expands into a card listing the top live courses from
// /api/academy/courses with current price + discount, so every
// news visitor has a one-tap path into the Academy without us
// taking over their reading flow.
//
// Behavior:
// - Collapsed: small pill with a graduation-cap icon and a tiny
//   pulse dot to draw attention without being annoying.
// - Expanded: shows up to 6 active courses with title, level,
//   duration, and price block (sale price + strikethrough MRP +
//   discount %). Backdrop click + ESC key + close button all
//   dismiss it.
// - Auto-shows the panel ONCE per session after a short scroll/
//   dwell (~6s) so first-time visitors actually notice it.
// - Remembers a per-session "dismissed" flag so we don't keep
//   poking the same reader.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Sparkles,
  X,
} from 'lucide-react';

interface ApiCourse {
  id: string;
  title?: string;
  level?: string;
  duration_hours?: number | string;
  price?: number | string;
  discountPrice?: number | string;
  discount_price?: number | string;
  thumbnail?: string;
  status?: string;
}

interface CourseLite {
  id: string;
  title: string;
  level?: string;
  duration_hours?: number;
  price: number;
  discountPrice: number;
}

const FALLBACK: CourseLite[] = [
  { id: 'food-hygiene-101', title: 'Food Hygiene 101', level: 'Basic', duration_hours: 2, price: 999, discountPrice: 499 },
  { id: 'haccp-fundamentals', title: 'HACCP Fundamentals', level: 'Intermediate', duration_hours: 4, price: 2499, discountPrice: 1499 },
  { id: 'allergen-management', title: 'Allergen Management', level: 'Advanced', duration_hours: 3, price: 1999, discountPrice: 1199 },
  { id: 'fssai-licensing', title: 'FSSAI Licensing & Compliance', level: 'Basic', duration_hours: 2, price: 1299, discountPrice: 799 },
  { id: 'fostac-supervisor', title: 'FoSTaC Supervisor Level', level: 'Intermediate', duration_hours: 4, price: 2999, discountPrice: 1799 },
  { id: 'iso-22000-lead', title: 'ISO 22000 Lead Auditor', level: 'Advanced', duration_hours: 5, price: 4999, discountPrice: 2999 },
];

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const formatINR = (n: number): string => {
  if (!n || n <= 0) return 'Free';
  try {
    return `₹${n.toLocaleString('en-IN')}`;
  } catch {
    return `₹${Math.round(n)}`;
  }
};

const LEVEL_TONE: Record<string, string> = {
  basic: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  beginner: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  intermediate: 'text-amber-700 bg-amber-50 border-amber-200',
  advanced: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
  expert: 'text-rose-700 bg-rose-50 border-rose-200',
};

const levelClass = (lvl?: string): string => {
  if (!lvl) return 'text-slate-700 bg-slate-50 border-slate-200';
  return LEVEL_TONE[lvl.toLowerCase()] || 'text-indigo-700 bg-indigo-50 border-indigo-200';
};

const SESSION_KEY = 'haccp.floatingCourses.dismissed';

interface FloatingCoursesProps {
  // When true, the panel opens immediately on mount and ignores the
  // per-session "dismissed" flag. Used on the /n/<token> share
  // landing where the popup IS the ad and must always be shown.
  autoOpen?: boolean;
  // Called whenever the user closes the panel (X button, backdrop
  // click, ESC). Lets the share landing fire its redirect only
  // after the ad has been seen and dismissed.
  onDismiss?: () => void;
  // When true, suppresses the FAB so only the expanded panel ever
  // shows. Useful on share landings where we want the ad once
  // and don't want a persistent floating button afterwards.
  hideFabAfterDismiss?: boolean;
  // When > 0 and the panel is open, renders a visible countdown
  // (seconds) so visitors know the parent will redirect them in
  // N seconds. Counting down does NOT itself fire the redirect —
  // the parent owns the actual setTimeout via onDismiss / its own
  // timer; this is purely a UX cue. Set to 0/undefined to hide.
  redirectInMs?: number;
}

export default function FloatingCourses({
  autoOpen = false,
  onDismiss,
  hideFabAfterDismiss = false,
  redirectInMs = 0,
}: FloatingCoursesProps = {}) {
  const [open, setOpen] = useState(autoOpen);
  const [dismissedOnce, setDismissedOnce] = useState(false);
  const [courses, setCourses] = useState<CourseLite[]>(FALLBACK);
  const autoOpenedRef = useRef(autoOpen);
  // Live countdown shown in the panel header when redirectInMs > 0.
  // Resets every time the panel opens so re-opening (rare here, but
  // possible) starts a fresh countdown.
  const [secondsLeft, setSecondsLeft] = useState<number>(
    redirectInMs > 0 ? Math.ceil(redirectInMs / 1000) : 0,
  );

  // Load live courses; keep fallback if the API has none so the
  // widget is always populated.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Pull from BOTH the on-demand course catalog and the
        // live-training calendar so the popup mirrors exactly what
        // the visitor sees on the session/course detail page they
        // click through to. Training-calendar uses `discount` as the
        // SAVINGS amount (sale = courseFee − discount), unlike the
        // course catalog where discountPrice IS the sale price.
        // See components/CourseRibbon.tsx for the same merge logic.
        const [coursesRes, trainingsRes] = await Promise.all([
          fetch('/api/academy/courses?status=published').catch(() => null),
          fetch('/api/training-calendar?public=1').catch(() => null),
        ]);
        const coursesJson = coursesRes ? await coursesRes.json().catch(() => ({})) : {};
        const trainingsJson = trainingsRes
          ? await trainingsRes.json().catch(() => ({}))
          : {};

        // Titles the admin has deactivated in the LMS Training
        // Calendar — used as a master kill-switch so the popup
        // never advertises a course whose live training is OFF.
        const deactivatedTitles = new Set<string>(
          Array.isArray(trainingsJson?.deactivatedTitles)
            ? trainingsJson.deactivatedTitles
                .filter((s: any): s is string => typeof s === 'string')
                .map((s: string) => s.trim().toLowerCase())
            : [],
        );

        const courseItems: CourseLite[] = (
          Array.isArray(coursesJson?.items) ? coursesJson.items : []
        )
          .filter(
            (c: ApiCourse) =>
              c &&
              typeof c.title === 'string' &&
              c.title.trim().length > 0 &&
              !deactivatedTitles.has(c.title.trim().toLowerCase()),
          )
          .map((c: ApiCourse) => ({
            id: String(c.id),
            title: String(c.title),
            level: c.level ? String(c.level) : undefined,
            duration_hours:
              c.duration_hours === undefined || c.duration_hours === null
                ? undefined
                : toNum(c.duration_hours),
            price: toNum(c.price),
            discountPrice: toNum(c.discountPrice ?? c.discount_price),
          }));

        const trainingItems: CourseLite[] = (
          Array.isArray(trainingsJson?.items) ? trainingsJson.items : []
        )
          .filter(
            (t: any) =>
              t &&
              t.isActive !== false &&
              typeof t.topic === 'string' &&
              t.topic.trim().length > 0,
          )
          .map((t: any) => {
            const fee = toNum(t.courseFee);
            const sav = toNum(t.discount);
            // Training-calendar semantics: `discount` is the SAVINGS
            // amount (₹ off the fee), not the sale price. Allow
            // sav === fee so a 100%-off promo collapses cleanly to
            // ₹0 / "Free" instead of falling back to the full fee
            // (which is what users were seeing in the popup vs the
            // calendar's "After Discount: ₹0 — SAVE ₹499" banner).
            // Clamp to zero so an over-stated discount can never go
            // negative.
            const sale =
              fee > 0 && sav > 0 ? Math.max(0, fee - sav) : fee;
            return {
              id: String(t.id),
              title: String(t.topic),
              level: t.mode ? String(t.mode) : undefined,
              duration_hours:
                typeof t.trainingHours === 'number' ? t.trainingHours : undefined,
              price: fee,
              discountPrice: sale,
            } as CourseLite;
          });

        // Dedupe by lowercased title; training-calendar entries
        // win when they carry a valid price (their pricing
        // semantics are the source of truth for the session-detail
        // page). Training rows missing a fee defer to the catalog
        // entry so an empty training record can't silently
        // downgrade a real paid course to "Free" in the popup.
        const byTitle = new Map<string, CourseLite>();
        for (const c of courseItems) byTitle.set(c.title.trim().toLowerCase(), c);
        for (const t of trainingItems) {
          const key = t.title.trim().toLowerCase();
          const existing = byTitle.get(key);
          const hasPrice = toNum(t.price) > 0 || toNum(t.discountPrice) > 0;
          if (!existing || hasPrice) byTitle.set(key, t);
        }
        const merged = Array.from(byTitle.values()).slice(0, 6);

        if (!cancelled && merged.length > 0) setCourses(merged);
      } catch (e) {
        console.error('FloatingCourses: course load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-pop the panel once per session after the reader has been
  // on the page long enough to be engaged. Skipped when autoOpen
  // is true (panel already opens on mount) and skipped if they've
  // already dismissed it this session.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (autoOpen) return;
    if (autoOpenedRef.current) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch {
      /* sessionStorage may be blocked — proceed silently */
    }
    const id = window.setTimeout(() => {
      autoOpenedRef.current = true;
      setOpen(true);
    }, 6000);
    return () => window.clearTimeout(id);
  }, [autoOpen]);

  // ESC closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Drive the visible countdown when a parent has scheduled an
  // auto-redirect. Tick once a second; clear on close / unmount /
  // when the count hits zero so we don't keep re-rendering forever.
  useEffect(() => {
    if (!open) return;
    if (redirectInMs <= 0) return;
    setSecondsLeft(Math.ceil(redirectInMs / 1000));
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Stop the interval the moment we hit zero — no point
          // burning a wakeup per second after the parent has
          // already (or is about to) fire its redirect.
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, redirectInMs]);

  const closePanel = () => {
    setOpen(false);
    setDismissedOnce(true);
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    if (onDismiss) {
      try {
        onDismiss();
      } catch {
        /* parent should not throw; defensive only */
      }
    }
  };

  // Highlight the deepest discount available so the FAB pill can
  // shout the offer (e.g. "Up to 50% off").
  const headlineDiscount = useMemo(() => {
    let best = 0;
    for (const c of courses) {
      if (c.price > 0 && c.discountPrice > 0 && c.discountPrice < c.price) {
        const pct = Math.round(((c.price - c.discountPrice) / c.price) * 100);
        if (pct > best) best = pct;
      }
    }
    return best;
  }, [courses]);

  return (
    <>
      {/* Backdrop only when expanded — keeps the rest of the page
          interactive when the FAB is collapsed. */}
      {open && (
        <button
          type="button"
          aria-label="Close training courses"
          onClick={closePanel}
          className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-[2px] md:bg-slate-900/20"
        />
      )}

      <div
        className={`fixed z-[70] right-3 sm:right-5 ${
          open ? 'bottom-3 sm:bottom-5' : 'bottom-4 sm:bottom-6'
        } pointer-events-none`}
      >
        {/* Collapsed FAB. Hidden after dismiss when the parent
            opted in (share-landing flow), so we don't keep nagging
            after the user has already seen the offer. */}
        {!open && !(hideFabAfterDismiss && dismissedOnce) && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto group inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
            aria-label="Show training courses"
          >
            <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15">
              <GraduationCap className="w-4.5 h-4.5" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-700">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </span>
            </span>
            <span className="text-xs font-extrabold tracking-wide">
              Training Courses
            </span>
            {headlineDiscount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-amber-300 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Up to {headlineDiscount}% off
              </span>
            )}
          </button>
        )}

        {/* Expanded panel */}
        {open && (
          <div
            role="dialog"
            aria-label="Training courses"
            className="pointer-events-auto w-[92vw] max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/20 border border-slate-200 overflow-hidden flex flex-col"
            style={{ maxHeight: 'min(80vh, 640px)' }}
          >
            <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-white px-5 py-4">
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close"
                className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {/* Auto-redirect countdown — only rendered when a
                  parent (e.g. the share landing) has scheduled a
                  timed redirect. Gives visitors a clear "you have
                  N seconds before we send you to the article"
                  signal so the popup doesn't feel like a trap. */}
              {redirectInMs > 0 && secondsLeft > 0 && (
                <div className="absolute top-3 right-14 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-[10px] font-black uppercase tracking-widest tabular-nums">
                  <span className="relative inline-flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-75" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-300" />
                  </span>
                  Redirect in {secondsLeft}s
                </div>
              )}
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/15 text-white text-[10px] font-black uppercase tracking-widest">
                <GraduationCap className="w-3.5 h-3.5" />
                HACCP PRO Academy
              </div>
              <h3 className="mt-2 text-lg font-black tracking-tight leading-tight">
                Train your team in food safety
              </h3>
              <p className="mt-1 text-[12px] text-indigo-100">
                Live, accredited courses — start today, certify in days.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
              {courses.map((c) => {
                // A discount exists whenever the sale price is
                // strictly below the MRP — including the ₹0 "Free"
                // case, which previously suppressed the strikethrough
                // and % badge because the gate required discountPrice > 0.
                const hasDiscount =
                  c.price > 0 && c.discountPrice >= 0 && c.discountPrice < c.price;
                const sale = hasDiscount ? c.discountPrice : c.price;
                const pct = hasDiscount
                  ? Math.round(((c.price - c.discountPrice) / c.price) * 100)
                  : 0;
                return (
                  <Link
                    key={c.id}
                    href={`/courses/${encodeURIComponent(c.id)}`}
                    onClick={closePanel}
                    className="group flex items-stretch gap-3 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-3 transition-all"
                  >
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-slate-900 text-[13px] leading-tight line-clamp-2">
                          {c.title}
                        </div>
                        <ArrowRight className="shrink-0 w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors mt-0.5" />
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {c.level && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${levelClass(
                              c.level,
                            )}`}
                          >
                            {c.level}
                          </span>
                        )}
                        {c.duration_hours && c.duration_hours > 0 && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {c.duration_hours} hr
                            {c.duration_hours === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[14px] font-black text-slate-900">
                          {formatINR(sale)}
                        </span>
                        {hasDiscount && (
                          <>
                            <span className="text-[11px] font-semibold text-slate-400 line-through">
                              {formatINR(c.price)}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                              {pct}% OFF
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="p-3 bg-white border-t border-slate-200">
              <Link
                href="/academy"
                onClick={closePanel}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm font-extrabold hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
              >
                Browse all courses <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
