'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Mail,
  MapPin,
  Printer,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react';
import PublicSiteShell from './PublicSiteShell';
import { QRCodeSVG } from 'qrcode.react';
import { sanitizeNewsHtml } from '@/lib/sanitizeNewsHtml';
import { normalizeImageUrl } from '@/lib/normalizeImageUrl';
import {
  type LandingLang,
  type LandingStrings,
  localizedField,
  useLandingT,
} from '@/lib/landingI18n';
import ShareButton from './ShareButton';

interface SafetyTip {
  id: string;
  slug?: string;
  title?: string;
  category?: string;
  excerpt?: string;
  body?: string;
  cover_image?: string;
  // Smaller, hook-style image used only in social-share previews
  // (OpenGraph / Twitter card). The reader page itself still renders
  // cover_image as the in-page hero — share_image never appears in the
  // body.
  share_image?: string;
  published_on?: string;
  read_minutes?: number;
  status?: string;
  author?: string;
  related_course_id?: string;
  related_training_session_id?: string;
  fallback_training_session_ids?: string[];
  cta_headline?: string;
  cta_button_label?: string;
  // Optional editor-supplied callout shown as an "Expert Auditor Note"
  // block on the detail page. Stored as plain text (not HTML) — the
  // reader doesn't sanitise it.
  auditor_note?: string;
  translations?: Partial<Record<LandingLang, Record<string, unknown>>> | null;
}

interface TrainingSession {
  id: string;
  topic?: string;
  subTopic?: string;
  description?: string;
  thumbnailImage?: string;
  status?: string;
  mode?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  trainer?: string;
  location?: string;
  courseFee?: number;
  discount?: number;
  isActive?: boolean;
  trainingHours?: number;
  registrationExpiryDate?: string;
}

// A session is "bookable" today when it's still active, hasn't already
// completed, has a valid future start date, and the registration window
// (used as our soft "sold-out" signal) hasn't elapsed. Sessions with
// missing or unparsable dates are excluded — same rule the legacy
// upcomingSessions filter enforced — so readers never land on undated
// or stale Recommended Training cards. Applied to both auto-matched
// and admin-pinned fallbacks.
const isBookableSession = (s: TrainingSession, todayMs: number): boolean => {
  if (!s) return false;
  if (s.isActive === false) return false;
  if ((s.status || '').toLowerCase() === 'completed') return false;
  if (!s.date) return false;
  const d = Date.parse(s.date);
  if (Number.isNaN(d)) return false;
  if (d < todayMs) return false;
  if (s.registrationExpiryDate) {
    const exp = Date.parse(s.registrationExpiryDate);
    if (!Number.isNaN(exp) && exp < todayMs) return false;
  }
  return true;
};

interface Course {
  id: string;
  title?: string;
  short_description?: string;
  description?: string;
  thumbnail?: string;
  status?: string;
  level?: string;
  language?: string;
  duration?: number;
  price?: number;
  discount_price?: number;
}

const formatDate = (iso: string | undefined, locale: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const formatLongDate = (iso: string | undefined, locale: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(locale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const formatPrice = (n: number | undefined, locale: string, freeLabel: string) => {
  if (n == null || n <= 0) return freeLabel;
  return `\u20B9${Number(n).toLocaleString(locale)}`;
};

const norm = (s: string | undefined): string =>
  (s || '').toLowerCase().normalize('NFKD').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UtmTags {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}

const readUtmFromLocation = (): UtmTags => {
  if (typeof window === 'undefined') return {};
  try {
    const sp = new URLSearchParams(window.location.search);
    const pick = (k: string) => {
      const v = sp.get(k);
      if (!v) return undefined;
      const t = v.trim();
      return t ? t.slice(0, 200) : undefined;
    };
    return {
      source: pick('utm_source'),
      medium: pick('utm_medium'),
      campaign: pick('utm_campaign'),
      content: pick('utm_content'),
    };
  } catch {
    return {};
  }
};

export default function TipReaderPage({
  slug,
  shareUrl,
  initialPublicOnly = false,
}: {
  slug: string;
  shareUrl?: string;
  initialPublicOnly?: boolean;
}) {
  const { t, lang, locale } = useLandingT();
  const [tip, setTip] = useState<SafetyTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  // Capture UTM tags once on mount so a later in-page link change can't
  // wipe the original attribution before the form is submitted.
  const [utm] = useState<UtmTags>(() => readUtmFromLocation());
  // Sibling-tip data powers the sidebar Categories list and the
  // bottom Next-tip navigation card. Fetched once on mount.
  const [allTips, setAllTips] = useState<SafetyTip[]>([]);
  // Compact sidebar subscribe form — reuses /api/academy/public-enrolments
  // with a synthetic course id so the lead lands in the same admin inbox.
  const [subEmail, setSubEmail] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subDone, setSubDone] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const localisedTitle = localizedField(tip, lang, 'title');
  const localisedExcerpt = localizedField(tip, lang, 'excerpt');
  const localisedCategory = localizedField(tip, lang, 'category');
  const localisedBody = localizedField(tip, lang, 'body');
  const localisedCtaHeadline = localizedField(tip, lang, 'cta_headline');
  const localisedCtaButton = localizedField(tip, lang, 'cta_button_label');
  const localisedAuditorNote = localizedField(tip, lang, 'auditor_note');

  const safeBody = useMemo(() => sanitizeNewsHtml(localisedBody || ''), [localisedBody]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/academy/safety-tips?slug=${encodeURIComponent(slug)}`);
        const j = await r.json();
        if (cancelled) return;
        if (!j?.item) {
          setNotFound(true);
        } else {
          setTip(j.item);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/training-calendar?public=1');
        const j = await r.json();
        const items: TrainingSession[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) setTrainings(items);
      } catch {
        if (!cancelled) setTrainings([]);
      }
    })();
    (async () => {
      try {
        const r = await fetch('/api/academy/courses?status=Active');
        const j = await r.json();
        const items: Course[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) setCourses(items);
      } catch {
        if (!cancelled) setCourses([]);
      }
    })();
    (async () => {
      try {
        const r = await fetch('/api/academy/safety-tips?public=1');
        const j = await r.json();
        const items: SafetyTip[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) setAllTips(items);
      } catch {
        if (!cancelled) setAllTips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = heroRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [loading]);

  const upcomingSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    return trainings
      .filter((s) => s && isBookableSession(s, todayMs))
      .sort((a, b) => Date.parse(a.date || '') - Date.parse(b.date || ''));
  }, [trainings]);

  const explicitSession = useMemo<TrainingSession | null>(() => {
    if (!tip?.related_training_session_id) return null;
    return trainings.find((s) => s.id === tip.related_training_session_id) || null;
  }, [tip?.related_training_session_id, trainings]);

  const explicitCourse = useMemo<Course | null>(() => {
    if (!tip?.related_course_id) return null;
    return courses.find((c) => c.id === tip.related_course_id) || null;
  }, [tip?.related_course_id, courses]);

  const fallbackSessions = useMemo<TrainingSession[]>(() => {
    if (explicitSession) return [];
    // 1. Admin-pinned fallback IDs win — preserve their order, drop any
    //    that have since gone stale / sold-out, cap to 3.
    const pinnedIds = Array.isArray(tip?.fallback_training_session_ids)
      ? tip!.fallback_training_session_ids!.filter(
          (id) => typeof id === 'string' && id.trim(),
        )
      : [];
    if (pinnedIds.length) {
      const upcomingById = new Map(upcomingSessions.map((s) => [s.id, s]));
      const pinned = pinnedIds
        .map((id) => upcomingById.get(id))
        .filter((s): s is TrainingSession => !!s)
        .slice(0, 3);
      if (pinned.length) return pinned;
    }
    // 2. No usable pins — fall back to the legacy auto-match by category.
    const cats = [norm(tip?.category), norm(localisedCategory)].filter(
      (c, i, arr) => c && arr.indexOf(c) === i,
    );
    if (!cats.length) return upcomingSessions.slice(0, 3);
    const matching = upcomingSessions.filter((s) => {
      const haystack = norm(`${s.topic || ''} ${s.subTopic || ''} ${s.description || ''}`);
      return cats.some(
        (cat) =>
          haystack.includes(cat) ||
          cat.split(' ').some((tok) => tok.length > 3 && haystack.includes(tok)),
      );
    });
    return (matching.length ? matching : upcomingSessions).slice(0, 3);
  }, [
    explicitSession,
    upcomingSessions,
    tip?.category,
    tip?.fallback_training_session_ids,
    localisedCategory,
  ]);

  const primarySession = explicitSession || fallbackSessions[0] || null;

  const ctaHeadline =
    localisedCtaHeadline?.trim() ||
    tip?.cta_headline?.trim() ||
    t.tipMarketingDefaultCtaHeadline;
  const ctaButton =
    localisedCtaButton?.trim() ||
    tip?.cta_button_label?.trim() ||
    t.tipMarketingDefaultCtaButton;

  // Sidebar Categories — group sibling tips by their (English) category
  // and surface the top buckets. Counts include the current tip so the
  // numbers feel honest even when allTips hasn't loaded yet.
  const sidebarCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const x of allTips) {
      const c = (x.category || '').trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [allTips]);

  // Next tip — the chronologically newer published tip in the same
  // category, falling back to the next newer tip overall. We sort
  // descending by published_on so "next" means "more recent than this
  // one" — matching how the home grid surfaces the latest tips first.
  const nextTip = useMemo<SafetyTip | null>(() => {
    if (!tip || !allTips.length) return null;
    const sorted = [...allTips].sort(
      (a, b) => Date.parse(b.published_on || '') - Date.parse(a.published_on || ''),
    );
    const idx = sorted.findIndex((x) => x.id === tip.id);
    if (idx < 0) return sorted[0] && sorted[0].id !== tip.id ? sorted[0] : null;
    // The "next" tip in the reader sense is the one published just BEFORE
    // this one (older), so the user can keep going down the archive.
    return sorted[idx + 1] || null;
  }, [tip, allTips]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubError(null);
    const email = subEmail.trim();
    if (!email) {
      setSubError(t.tipMarketingLeadFormRequired);
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setSubError(t.tipMarketingLeadFormInvalidEmail);
      return;
    }
    setSubSubmitting(true);
    try {
      const localPart = email.split('@')[0] || 'Subscriber';
      const r = await fetch('/api/academy/public-enrolments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: 'tips:weekly-digest',
          course_title: 'Weekly Food Safety Updates',
          name: localPart,
          email,
          notes: `tips:weekly-digest from /tips/${slug}`,
          utm_source: utm?.source,
          utm_medium: utm?.medium,
          utm_campaign: utm?.campaign,
          utm_content: utm?.content,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error || 'failed');
      }
      setSubDone(true);
      setSubEmail('');
    } catch (err) {
      setSubError(
        err instanceof Error && err.message && err.message !== 'failed'
          ? err.message
          : t.tipMarketingLeadFormError,
      );
    } finally {
      setSubSubmitting(false);
    }
  };

  return (
    <PublicSiteShell activeSection="tips" initialPublicOnly={initialPublicOnly}>
      <main className="bg-gradient-to-b from-slate-50 to-white pb-32 print:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <Link
            href="/#tips"
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-500 hover:text-emerald-600 print:hidden"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t.tipsBackToTips}
          </Link>

          {loading ? (
            <div className="flex items-center justify-center py-32 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.tipsLoading}
            </div>
          ) : notFound || !tip ? (
            <div className="py-32 text-center">
              <p className="text-lg font-extrabold text-slate-900">{t.tipsNotFoundTitle}</p>
              <p className="mt-2 text-sm text-slate-500">{t.tipsNotFoundBody}</p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800"
              >
                {t.newsReturnHome}
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
              {/* MAIN COLUMN ─────────────────────────────────────────── */}
              <article className="min-w-0">
                {/* HERO CARD — image, emerald category pill (top-left)
                    and bold white title overlaid on a dark gradient at
                    the bottom. Hides the gradient gracefully when no
                    cover image is set. */}
                <div
                  ref={heroRef}
                  className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm"
                >
                  <div className="relative aspect-[16/10] bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400">
                    {tip.cover_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={normalizeImageUrl(tip.cover_image)}
                        alt={localisedTitle || t.newsCoverAlt}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-transparent" />
                    {localisedCategory && (
                      <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30">
                        <Tag className="w-3 h-3" /> {localisedCategory}
                      </span>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                      <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight tracking-tight drop-shadow">
                        {localisedTitle || t.untitledTip}
                      </h1>
                    </div>
                  </div>
                </div>

                {/* META ROW — read time + category + share button */}
                <div className="mt-5 flex items-center justify-between flex-wrap gap-3 text-[12px] font-bold text-slate-500">
                  <div className="flex flex-wrap items-center gap-4">
                    {tip.read_minutes ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {tip.read_minutes} {t.cardMinRead}
                      </span>
                    ) : null}
                    {localisedCategory && (
                      <span className="inline-flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> {localisedCategory}
                      </span>
                    )}
                    {tip.published_on && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />{' '}
                        {formatDate(tip.published_on, locale)}
                      </span>
                    )}
                    {tip.author && (
                      <span className="inline-flex items-center gap-1.5">
                        {t.newsBy} <span className="text-emerald-600">{tip.author}</span>
                      </span>
                    )}
                  </div>
                  <ShareButton
                    url={shareUrl || (typeof window !== 'undefined' ? window.location.href : '')}
                    title={localisedTitle || t.untitledTip}
                    text={localisedExcerpt || ''}
                    label={t.shareLabel}
                    copiedLabel={t.shareCopied}
                    utm={{ source: 'share' }}
                  />
                </div>

                {/* EXCERPT — italicised lead paragraph */}
                {localisedExcerpt && (
                  <p className="mt-6 text-base sm:text-lg italic text-slate-600 leading-relaxed font-medium">
                    {localisedExcerpt}
                  </p>
                )}

                {/* DETAILED PROTOCOL IMPLEMENTATION — body content
                    rendered inside a clearly-titled section so the
                    article reads like an SOP and not a generic blog
                    post. */}
                {safeBody && (
                  <div className="mt-8">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {t.tipsBodyHeading}
                    </h2>
                    <div
                      className="prose prose-slate max-w-none mt-4 text-[15px] leading-relaxed text-slate-700 [&_p]:my-4 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-extrabold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-emerald-600 [&_a]:underline [&_img]:rounded-xl [&_img]:my-4"
                      dangerouslySetInnerHTML={{ __html: safeBody }}
                    />
                  </div>
                )}

                {/* EXPERT AUDITOR NOTE — only rendered when the tip
                    record carries an explicit auditor_note field. We
                    don't fabricate one to avoid putting words in an
                    auditor's mouth. */}
                {localisedAuditorNote.trim() && (
                  <aside className="mt-8 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/60 p-5 flex gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 inline-flex items-center justify-center">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-emerald-700">
                        {t.tipsAuditorNoteTitle}
                      </div>
                      <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                        {localisedAuditorNote.trim()}
                      </p>
                    </div>
                  </aside>
                )}

                {/* EXISTING FUNCTIONAL PANELS — kept below the new
                    hero/body so the sales funnel (training CTA, full-
                    course offer, lead capture form, printable QR for
                    the kitchen wall) still works. */}
                <TrustStrip t={t} />
                <RecommendedTrainingPanel
                  t={t}
                  locale={locale}
                  ctaHeadline={ctaHeadline}
                  ctaButton={ctaButton}
                  explicitSession={explicitSession}
                  fallbackSessions={fallbackSessions}
                />
                {explicitCourse && (
                  <FullCourseCard t={t} locale={locale} course={explicitCourse} />
                )}
                <LeadCaptureForm
                  t={t}
                  tipSlug={tip.slug || slug}
                  tipTitle={localisedTitle || tip.title || ''}
                  relatedCourseId={tip.related_course_id}
                  relatedCourseTitle={explicitCourse?.title}
                  utm={utm}
                />
                <PrintableQrTile
                  t={t}
                  shareUrl={shareUrl || (typeof window !== 'undefined' ? window.location.href : '')}
                  title={localisedTitle || t.untitledTip}
                />

                {/* NEXT TIP NAVIGATION — full-width card pointing to
                    the next published tip, mirrors the reference. */}
                {nextTip && (
                  <Link
                    href={`/tips/${encodeURIComponent(nextTip.slug || nextTip.id)}`}
                    className="mt-8 group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all p-5 print:hidden"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        {t.tipsNextTipLabel}
                      </div>
                      <div className="mt-1 text-base sm:text-lg font-extrabold text-slate-900 truncate">
                        {localizedField(nextTip, lang, 'title') || nextTip.title || t.untitledTip}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                )}

                {/* FOOTER ACTIONS — back link + share */}
                <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap print:hidden">
                  <Link
                    href="/#tips"
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-500 hover:text-emerald-600"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> {t.tipsBackToTips}
                  </Link>
                  <ShareButton
                    url={shareUrl || (typeof window !== 'undefined' ? window.location.href : '')}
                    title={localisedTitle || t.untitledTip}
                    text={localisedExcerpt || ''}
                    label={t.shareLabel}
                    copiedLabel={t.shareCopied}
                    utm={{ source: 'share' }}
                  />
                </div>
              </article>

              {/* SIDEBAR ─────────────────────────────────────────────── */}
              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start print:hidden">
                {/* Master Food Safety with Certification — green promo */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white shadow-xl shadow-emerald-500/20">
                  <div className="text-emerald-100 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> {t.tipsSidebarPromoEyebrow}
                  </div>
                  <h3 className="mt-2 text-xl font-black leading-tight">
                    {t.tipsSidebarPromoTitle}
                  </h3>
                  <p className="mt-2 text-[13px] text-emerald-50/90 leading-relaxed">
                    {t.tipsSidebarPromoBody}
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> HACCP Fundamentals
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Food Hygiene 101
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> FSSAI Compliance
                    </div>
                  </div>
                  <Link
                    href="/#courses"
                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 bg-white text-emerald-700 py-2.5 rounded-xl font-extrabold text-[11px] uppercase tracking-widest hover:bg-emerald-50 transition-colors"
                  >
                    {t.tipsSidebarPromoButton}
                  </Link>
                </div>

                {/* Protocol Categories — links back to /#tips */}
                {sidebarCategories.length > 0 && (
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600" />{' '}
                      {t.tipsSidebarCategoriesTitle}
                    </div>
                    <ul className="mt-4 space-y-1">
                      {sidebarCategories.map((c) => (
                        <li key={c.name}>
                          <Link
                            href="/#tips"
                            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-[13px] font-bold text-slate-700"
                          >
                            <span>{c.name}</span>
                            <span className="text-slate-400">{c.count}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weekly Updates — compact subscribe form */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5">
                  <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-600" />{' '}
                    {t.tipsSidebarSubscribeTitle}
                  </div>
                  <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
                    {t.tipsSidebarSubscribeBody}
                  </p>
                  {subDone ? (
                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {t.tipMarketingLeadFormSuccess}
                    </p>
                  ) : (
                    <form onSubmit={handleSubscribe} className="mt-3 space-y-2">
                      <label htmlFor="tip-sidebar-subscribe-email" className="sr-only">
                        {t.tipMarketingLeadFormEmail}
                      </label>
                      <input
                        id="tip-sidebar-subscribe-email"
                        type="email"
                        value={subEmail}
                        onChange={(e) => setSubEmail(e.target.value)}
                        placeholder={t.tipsSidebarSubscribeEmailPlaceholder}
                        aria-label={t.tipMarketingLeadFormEmail}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
                        required
                      />
                      <button
                        type="submit"
                        disabled={subSubmitting}
                        className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-60"
                      >
                        {subSubmitting ? t.tipMarketingLeadFormSubmitting : t.tipsSidebarSubscribeButton}
                      </button>
                      {subError && (
                        <p
                          role="alert"
                          aria-live="assertive"
                          className="text-[11px] text-rose-600 font-bold"
                        >
                          {subError}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* STICKY BOTTOM CTA BAR — appears once the hero scrolls out of
          view. Hidden on print so paper copies stay clean. */}
      {tip && !loading && !notFound && primarySession && showSticky && (
        <StickyTrainingBar
          t={t}
          locale={locale}
          session={primarySession}
          ctaButton={ctaButton}
        />
      )}
    </PublicSiteShell>
  );
}

function TrustStrip({ t }: { t: LandingStrings }) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur px-5 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {t.tipMarketingTrustEyebrow}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="inline-flex items-center gap-2 text-[12px] font-extrabold text-slate-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> {t.tipMarketingTrustFssai}
        </span>
        <span className="inline-flex items-center gap-2 text-[12px] font-extrabold text-slate-700">
          <BadgeCheck className="w-4 h-4 text-indigo-600" /> {t.tipMarketingTrustHaccp}
        </span>
        <span className="inline-flex items-center gap-2 text-[12px] font-extrabold text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-violet-600" /> {t.tipMarketingTrustIso}
        </span>
      </div>
    </div>
  );
}

function RecommendedTrainingPanel({
  t,
  locale,
  ctaHeadline,
  ctaButton,
  explicitSession,
  fallbackSessions,
}: {
  t: LandingStrings;
  locale: string;
  ctaHeadline: string;
  ctaButton: string;
  explicitSession: TrainingSession | null;
  fallbackSessions: TrainingSession[];
}) {
  const sessions = explicitSession ? [explicitSession] : fallbackSessions;
  if (!sessions.length) return null;
  const featured = explicitSession || fallbackSessions[0];
  const rest = explicitSession ? [] : fallbackSessions.slice(1);
  return (
    <section className="mt-10 rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 overflow-hidden print:hidden">
      <div className="px-5 sm:px-7 pt-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest">
          <Sparkles className="w-3 h-3" /> {t.tipMarketingRecommendedTrainingEyebrow}
        </span>
        <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
          {ctaHeadline}
        </h2>
        <p className="mt-1.5 text-sm font-medium text-slate-600">
          {explicitSession
            ? t.tipMarketingRecommendedTrainingTitle
            : t.tipMarketingRecommendedTrainingFallbackTitle}
        </p>
      </div>
      <div className="px-5 sm:px-7 pb-6 pt-5">
        <FeaturedSessionCard t={t} locale={locale} session={featured} ctaButton={ctaButton} />
        {rest.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rest.map((s) => (
              <CompactSessionCard key={s.id} t={t} locale={locale} session={s} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturedSessionCard({
  t,
  locale,
  session,
  ctaButton,
}: {
  t: LandingStrings;
  locale: string;
  session: TrainingSession;
  ctaButton: string;
}) {
  const fee = typeof session.courseFee === 'number' ? session.courseFee : undefined;
  const disc = typeof session.discount === 'number' ? session.discount : 0;
  const finalFee = fee != null && disc > 0 ? Math.max(0, fee - disc) : fee;
  const titleParts = [session.topic, session.subTopic].filter(Boolean);
  const title = titleParts.join(' \u2014 ') || t.untitledTraining;
  return (
    <div className="rounded-2xl bg-white border border-indigo-100 shadow-md shadow-indigo-500/10 overflow-hidden flex flex-col sm:flex-row">
      {session.thumbnailImage ? (
        <div className="sm:w-56 aspect-[16/9] sm:aspect-auto bg-slate-100 overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={normalizeImageUrl(session.thumbnailImage)} alt={title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="sm:w-56 aspect-[16/9] sm:aspect-auto bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-indigo-300 flex-shrink-0">
          <CalendarDays className="w-10 h-10" />
        </div>
      )}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center gap-2">
          {session.mode && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
              {session.mode}
            </span>
          )}
          {finalFee != null && (
            <span className="inline-flex items-baseline gap-1.5 text-[13px] font-extrabold text-slate-900">
              {formatPrice(finalFee, locale, t.free)}
              {fee != null && disc > 0 && (
                <span className="text-[11px] font-bold text-slate-400 line-through">
                  {formatPrice(fee, locale, t.free)}
                </span>
              )}
            </span>
          )}
        </div>
        <h3 className="mt-2 font-extrabold text-slate-900 text-lg leading-snug">{title}</h3>
        <div className="mt-2 grid grid-cols-1 gap-1.5 text-[12px] font-bold text-slate-500">
          {session.date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />{' '}
              {formatLongDate(session.date, locale)}
              {(session.startTime || session.endTime) && (
                <span className="text-slate-400">
                  {' \u00B7 '}
                  {[session.startTime, session.endTime].filter(Boolean).join(' \u2013 ')}
                </span>
              )}
            </span>
          )}
          {session.trainer && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-500" /> {t.tipMarketingTrainerLabel}
              {': '}
              {session.trainer}
            </span>
          )}
          {session.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" /> {session.location}
            </span>
          )}
        </div>
        <div className="mt-4">
          <Link
            href={`/training-register/${encodeURIComponent(session.id)}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[12px] uppercase tracking-widest shadow-md shadow-indigo-500/30"
          >
            {ctaButton} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function CompactSessionCard({
  t,
  locale,
  session,
}: {
  t: LandingStrings;
  locale: string;
  session: TrainingSession;
}) {
  const titleParts = [session.topic, session.subTopic].filter(Boolean);
  const title = titleParts.join(' \u2014 ') || t.untitledTraining;
  const fee = typeof session.courseFee === 'number' ? session.courseFee : undefined;
  const disc = typeof session.discount === 'number' ? session.discount : 0;
  const finalFee = fee != null && disc > 0 ? Math.max(0, fee - disc) : fee;
  return (
    <Link
      href={`/training-register/${encodeURIComponent(session.id)}`}
      className="group rounded-2xl bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-lg transition-all p-4 flex flex-col"
    >
      <div className="flex items-center gap-2 flex-wrap">
        {session.mode && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest">
            {session.mode}
          </span>
        )}
        {session.date && (
          <span className="text-[11px] font-extrabold text-slate-500">
            {formatDate(session.date, locale)}
          </span>
        )}
      </div>
      <h4 className="mt-2 font-extrabold text-slate-900 text-sm leading-snug line-clamp-2">
        {title}
      </h4>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] font-extrabold text-slate-900">
          {formatPrice(finalFee, locale, t.free)}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 group-hover:gap-2 transition-all">
          {t.cardRegister} <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}

function FullCourseCard({
  t,
  locale,
  course,
}: {
  t: LandingStrings;
  locale: string;
  course: Course;
}) {
  const fee = typeof course.price === 'number' ? course.price : undefined;
  const disc = typeof course.discount_price === 'number' ? course.discount_price : undefined;
  const finalFee = disc != null && disc >= 0 ? disc : fee;
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 print:hidden">
      <div className="flex items-start gap-4">
        <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 items-center justify-center flex-shrink-0">
          <BadgeCheck className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-black uppercase tracking-widest">
            {t.tipMarketingTakeFullCourseEyebrow}
          </span>
          <h3 className="mt-2 text-xl font-black text-slate-900 leading-snug">
            {t.tipMarketingTakeFullCourseTitle}
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-600 line-clamp-2">
            {course.title || ''}
            {course.short_description ? ` \u2014 ${course.short_description}` : ''}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-baseline gap-2 text-sm font-extrabold text-slate-900">
              {formatPrice(finalFee, locale, t.free)}
              {fee != null && disc != null && disc < fee && (
                <span className="text-[11px] font-bold text-slate-400 line-through">
                  {formatPrice(fee, locale, t.free)}
                </span>
              )}
            </span>
            <Link
              href={`/courses/${encodeURIComponent(course.id)}?source=academy`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-widest"
            >
              {t.tipMarketingExploreCourse} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function LeadCaptureForm({
  t,
  tipSlug,
  tipTitle,
  relatedCourseId,
  relatedCourseTitle,
  utm,
}: {
  t: LandingStrings;
  tipSlug: string;
  tipTitle: string;
  relatedCourseId?: string;
  relatedCourseTitle?: string;
  utm?: UtmTags;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim() || !email.trim()) {
      setErrorMsg(t.tipMarketingLeadFormRequired);
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErrorMsg(t.tipMarketingLeadFormInvalidEmail);
      return;
    }
    setSubmitting(true);
    try {
      const courseId = relatedCourseId?.trim() || `tip:${tipSlug}`;
      const courseTitle =
        relatedCourseTitle?.trim() || (tipTitle ? `Tip: ${tipTitle}` : `Tip: ${tipSlug}`);
      const payload = {
        course_id: courseId,
        course_title: courseTitle,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: `tip:${tipSlug}`,
        utm_source: utm?.source,
        utm_medium: utm?.medium,
        utm_campaign: utm?.campaign,
        utm_content: utm?.content,
      };
      const r = await fetch('/api/academy/public-enrolments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error || 'failed');
      }
      setSuccess(true);
      setName('');
      setEmail('');
      setPhone('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message && err.message !== 'failed'
          ? err.message
          : t.tipMarketingLeadFormError,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 sm:p-7 print:hidden">
      <div className="flex items-start gap-3">
        <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-900 leading-snug">
            {t.tipMarketingLeadFormTitle}
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {t.tipMarketingLeadFormSubtitle}
          </p>
        </div>
      </div>
      {success ? (
        <div className="mt-5 rounded-2xl bg-white border-2 border-emerald-200 p-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="mt-2 font-extrabold text-slate-900">{t.tipMarketingLeadFormSuccess}</p>
          <p className="mt-1 text-sm text-slate-600">{t.tipMarketingLeadFormSuccessBody}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.tipMarketingLeadFormName}
            autoComplete="name"
            required
            className="sm:col-span-2 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-bold text-slate-900 bg-white"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.tipMarketingLeadFormEmail}
            autoComplete="email"
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-bold text-slate-900 bg-white"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.tipMarketingLeadFormPhone}
            autoComplete="tel"
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-bold text-slate-900 bg-white"
          />
          {errorMsg && (
            <div className="sm:col-span-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] font-bold text-rose-700">
              {errorMsg}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="sm:col-span-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-[12px] uppercase tracking-widest shadow-md shadow-emerald-500/30"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {t.tipMarketingLeadFormSubmitting}
              </>
            ) : (
              <>
                {t.tipMarketingLeadFormSubmit} <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
          <p className="sm:col-span-2 text-[10px] font-bold text-slate-500 text-center">
            {t.tipMarketingLeadFormConsent}
          </p>
        </form>
      )}
    </section>
  );
}

function PrintableQrTile({
  t,
  shareUrl,
  title,
}: {
  t: LandingStrings;
  shareUrl: string;
  title: string;
}) {
  const qrPayload = useMemo(() => {
    if (!shareUrl) return '';
    try {
      const u = new URL(shareUrl);
      u.searchParams.set('utm_source', 'qr');
      u.searchParams.set('utm_medium', 'print');
      return u.toString();
    } catch {
      return shareUrl;
    }
  }, [shareUrl]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 print:border-2 print:border-slate-300 print:shadow-none">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 print:p-4 flex-shrink-0">
          {qrPayload ? (
            <QRCodeSVG value={qrPayload} size={120} level="M" includeMargin={false} />
          ) : (
            <div className="w-[120px] h-[120px] bg-slate-100 rounded-md" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-slate-900 leading-snug">
            {t.tipMarketingQrTitle}
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {t.tipMarketingQrSubtitle}
          </p>
          <p className="mt-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 line-clamp-1 print:text-slate-600">
            {title}
          </p>
          <button
            type="button"
            onClick={handlePrint}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-slate-200 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 font-extrabold text-[11px] uppercase tracking-widest shadow-sm transition-colors print:hidden"
          >
            <Printer className="w-3.5 h-3.5" /> {t.tipMarketingPrintLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function StickyTrainingBar({
  t,
  locale,
  session,
  ctaButton,
}: {
  t: LandingStrings;
  locale: string;
  session: TrainingSession;
  ctaButton: string;
}) {
  const titleParts = [session.topic, session.subTopic].filter(Boolean);
  const title = titleParts.join(' \u2014 ') || t.untitledTraining;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 print:hidden">
      <div className="mx-auto max-w-3xl px-3 sm:px-6 pb-3 sm:pb-4">
        <div className="rounded-2xl bg-slate-900 text-white shadow-2xl shadow-slate-900/40 p-3 sm:p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
              {t.tipMarketingStickyTitle}
            </div>
            <div className="text-sm font-extrabold leading-snug truncate">{title}</div>
            {session.date && (
              <div className="text-[11px] font-bold text-slate-300 truncate">
                {t.tipMarketingStickyOnDate} {formatDate(session.date, locale)}
              </div>
            )}
          </div>
          <Link
            href={`/training-register/${encodeURIComponent(session.id)}`}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest shadow-md flex-shrink-0"
          >
            {ctaButton} <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
