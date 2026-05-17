'use client';

// Right-to-left infinite ribbon of active training courses, embedded
// on the public /news page as a lightweight cross-promo for HACCP
// PRO Academy. Pulls live courses from /api/academy/courses, then
// duplicates the list inline so the CSS marquee loops seamlessly
// without a visible "snap". Pauses on hover so readers can click.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react';

interface CourseLite {
  id: string;
  title?: string;
  level?: string;
  duration_hours?: number | string;
  // Optional commercial fields surfaced from the Academy catalogue.
  // The ribbon shows them when present so visitors see the offer
  // (sale price + crossed-out MRP) without leaving /news.
  price?: number | string;
  discountPrice?: number | string;
  discount_price?: number | string;
}

// Curated fallback shown when the academy_courses table is empty
// (fresh installs, demos, dev DB) so the advertisement ribbon is
// never a blank stripe. Mirrors the HACCP PRO Academy catalogue.
const FALLBACK_COURSES: CourseLite[] = [
  { id: 'food-hygiene-101', title: 'Food Hygiene 101', level: 'Basic', duration_hours: 2, price: 999, discountPrice: 499 },
  { id: 'allergen-management', title: 'Allergen Management', level: 'Advanced', duration_hours: 3, price: 1999, discountPrice: 1199 },
  { id: 'haccp-fundamentals', title: 'HACCP Fundamentals', level: 'Intermediate', duration_hours: 4, price: 2499, discountPrice: 1499 },
  { id: 'fssai-licensing', title: 'FSSAI Licensing & Compliance', level: 'Basic', duration_hours: 2, price: 1299, discountPrice: 799 },
  { id: 'fostac-supervisor', title: 'FoSTaC Supervisor Level', level: 'Intermediate', duration_hours: 4, price: 2999, discountPrice: 1799 },
  { id: 'iso-22000-lead', title: 'ISO 22000 Lead Auditor', level: 'Advanced', duration_hours: 5, price: 4999, discountPrice: 2999 },
  { id: 'cleaning-sanitation', title: 'Cleaning & Sanitation SOPs', level: 'Basic', duration_hours: 2, price: 899, discountPrice: 499 },
  { id: 'cold-chain', title: 'Cold Chain Management', level: 'Intermediate', duration_hours: 3, price: 1799, discountPrice: 1099 },
  { id: 'pest-control', title: 'Integrated Pest Management', level: 'Intermediate', duration_hours: 3, price: 1599, discountPrice: 999 },
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
  basic: 'text-emerald-600',
  beginner: 'text-emerald-600',
  intermediate: 'text-amber-600',
  advanced: 'text-fuchsia-600',
  expert: 'text-rose-600',
};

const toneFor = (lvl: string | undefined): string => {
  if (!lvl) return 'text-slate-500';
  return LEVEL_TONE[lvl.toLowerCase()] || 'text-indigo-600';
};

const formatHours = (h: number | string | undefined): string => {
  if (h === undefined || h === null || h === '') return '';
  const n = typeof h === 'number' ? h : parseFloat(String(h));
  if (Number.isNaN(n) || n <= 0) return '';
  return `${n} HOUR${n === 1 ? '' : 'S'}`;
};

interface CourseRibbonProps {
  eyebrow?: string;
  ctaLabel?: string;
}

export default function CourseRibbon({
  eyebrow = 'Featured Certifications',
  ctaLabel = 'Browse all courses',
}: CourseRibbonProps) {
  // Start with the fallback so the ribbon is visible immediately on
  // first paint (avoids an empty stripe while the API loads). Live
  // courses replace it once the fetch resolves.
  const [courses, setCourses] = useState<CourseLite[]>(FALLBACK_COURSES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // We pull from BOTH sources so the ad mirrors what the
        // visitor will actually see when they click through:
        //   • /api/academy/courses → on-demand catalog (price = MRP,
        //     discountPrice = sale price)
        //   • /api/training-calendar → live instructor-led sessions
        //     (courseFee = MRP, discount = SAVINGS amount, so the
        //     real sale price is courseFee − discount)
        // Training-calendar entries take precedence on title-collision
        // because their pricing semantics are the source of truth for
        // the public session-detail page. This guarantees the ribbon
        // and the detail page can never disagree on the price.
        const [coursesRes, trainingsRes] = await Promise.all([
          fetch('/api/academy/courses?status=published').catch(() => null),
          fetch('/api/training-calendar?public=1').catch(() => null),
        ]);
        const coursesJson = coursesRes ? await coursesRes.json().catch(() => ({})) : {};
        const trainingsJson = trainingsRes ? await trainingsRes.json().catch(() => ({})) : {};

        // Titles the admin has deactivated in the LMS Training
        // Calendar — used as a master kill-switch so the ribbon
        // never advertises a course whose live training is OFF.
        const deactivatedTitles = new Set<string>(
          Array.isArray(trainingsJson?.deactivatedTitles)
            ? trainingsJson.deactivatedTitles
                .filter((s: any): s is string => typeof s === 'string')
                .map((s: string) => s.trim().toLowerCase())
            : [],
        );

        const courseItems: CourseLite[] = (
          Array.isArray(coursesJson?.items)
            ? coursesJson.items
            : Array.isArray(coursesJson)
              ? coursesJson
              : []
        )
          .filter(
            (c: any) =>
              c &&
              typeof c.title === 'string' &&
              c.title.trim().length > 0 &&
              !deactivatedTitles.has(c.title.trim().toLowerCase()),
          )
          .map((c: any) => ({
            id: String(c.id),
            title: String(c.title),
            level: c.level ? String(c.level) : undefined,
            duration_hours: c.duration_hours,
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
            // Allow sav === fee so a 100%-off promo collapses to ₹0
            // (matches the "After Discount: ₹0" banner the admin sees
            // in the Training Calendar form). Clamp to zero so an
            // over-stated discount can't go negative.
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

        // Dedupe by lowercased title. Training-calendar entries
        // generally win — their pricing semantics are the source of
        // truth for the public session-detail page — but only when
        // they actually carry a valid price. Otherwise we keep the
        // catalog entry so a poorly-filled training row can't
        // silently downgrade a real paid course to "Free" in the ad.
        const byTitle = new Map<string, CourseLite>();
        for (const c of courseItems) {
          byTitle.set((c.title || '').trim().toLowerCase(), c);
        }
        for (const t of trainingItems) {
          const key = (t.title || '').trim().toLowerCase();
          const existing = byTitle.get(key);
          const hasPrice = toNum(t.price) > 0 || toNum(t.discountPrice) > 0;
          if (!existing || hasPrice) byTitle.set(key, t);
        }
        const merged = Array.from(byTitle.values()).slice(0, 24);
        if (!cancelled && merged.length > 0) setCourses(merged);
      } catch (e) {
        console.error('CourseRibbon load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (courses.length === 0) return null;

  // Duplicate the list so the keyframes can translateX(-50%) without
  // exposing the seam.
  const loop = [...courses, ...courses];

  return (
    <section className="relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-indigo-50/40 to-emerald-50/40 px-3 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3 px-2 sm:px-0 mb-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-[0.18em] border border-emerald-200/70">
              <GraduationCap className="w-3.5 h-3.5" />
              {eyebrow}
            </span>
            <Link
              href="/academy"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition-colors"
            >
              {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div
            className="course-ribbon group/ribbon relative overflow-hidden"
            // Edge fade masks make the loop feel infinite instead of cut off.
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)',
              maskImage:
                'linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)',
            }}
          >
            <div className="course-ribbon-track flex items-stretch gap-4 w-max">
              {loop.map((c, i) => {
                const hours = formatHours(c.duration_hours);
                const lvl = (c.level || '').toUpperCase();
                const mrp = toNum(c.price);
                const sale = toNum(c.discountPrice ?? c.discount_price);
                const hasDiscount = mrp > 0 && sale >= 0 && sale < mrp;
                const showPrice = mrp > 0 || sale > 0;
                const displayPrice = hasDiscount ? sale : mrp || sale;
                const pct = hasDiscount
                  ? Math.round(((mrp - sale) / mrp) * 100)
                  : 0;
                return (
                  <Link
                    key={`${c.id}-${i}`}
                    href={`/courses/${encodeURIComponent(c.id)}`}
                    aria-hidden={i >= courses.length}
                    tabIndex={i >= courses.length ? -1 : 0}
                    className="shrink-0 w-[280px] sm:w-[300px] bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all px-4 py-3.5 flex items-center gap-3"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-indigo-700">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-900 text-sm leading-tight truncate">
                        {c.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-bold tracking-wider">
                        {hours && (
                          <span className="text-slate-500 uppercase">{hours}</span>
                        )}
                        {hours && lvl && <span className="text-slate-300">·</span>}
                        {lvl && (
                          <span className={`uppercase ${toneFor(c.level)}`}>{lvl}</span>
                        )}
                      </div>
                      {showPrice && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-[13px] font-black text-slate-900">
                            {formatINR(displayPrice)}
                          </span>
                          {hasDiscount && (
                            <>
                              <span className="text-[10px] font-semibold text-slate-400 line-through">
                                {formatINR(mrp)}
                              </span>
                              <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black tracking-wider">
                                {pct}% OFF
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="shrink-0 w-4 h-4 text-slate-300 group-hover/ribbon:text-indigo-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="sm:hidden mt-4 flex justify-center">
            <Link
              href="/academy"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700"
            >
              {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
