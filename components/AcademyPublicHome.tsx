'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  Clock,
  Search,
  Loader2,
  CalendarDays,
  GraduationCap,
  Menu,
  X,
  ArrowRight,
  Lightbulb,
  Newspaper,
  ClipboardCheck,
  FileBadge,
  ScanLine,
  Award,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  ChevronRight,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Instagram,
  Globe,
  Bell,
  Gavel,
  ExternalLink,
} from 'lucide-react';
import {
  LANDING_LANGUAGES,
  type LandingLang,
  type LandingStrings,
  localizedField,
  useLandingT,
} from '@/lib/landingI18n';
import { normalizeImageUrl } from '@/lib/normalizeImageUrl';
import { usePublicOnlyMirror } from '@/utils/usePublicOnlyMirror';

// Marketing-style public landing page for the logged-out / route. The
// page is a single long-scroll layout where each top-nav item is an
// in-page anchor (no new routes). Sections are wired to existing
// public APIs:
//   • Training  → /api/training-calendar?public=1
//   • Tips      → /api/academy/safety-tips?public=1
//   • News      → /api/academy/news-posts?public=1
//   • Courses   → /api/academy/courses?status=Active
// Contact info (WhatsApp + email) is loaded from /api/app-settings.

interface AppSettingsBag {
  contact_email?: string;
  contact_phone?: string;
  whatsapp_number?: string;
  default_wa_country_code?: string;
}

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
  outcomes?: string[];
  requirements?: string[];
  enrolment_count?: number;
  price?: number;
  discount_price?: number;
  updated_at?: string;
  rating?: number;
  __source?: 'academy';
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
}

interface SafetyTip {
  id: string;
  slug?: string;
  title?: string;
  body?: string;
  category?: string;
  excerpt?: string;
  cover_image?: string;
  // Optional share-only thumbnail. Not rendered on this page — the
  // home tip cards keep using cover_image. Declared here so the type
  // matches the API payload and downstream code can read it without
  // casts.
  share_image?: string;
  icon?: string;
  status?: string;
  published_on?: string;
  read_minutes?: number;
  author?: string;
  // Optional per-language overrides keyed by LandingLang. Falls back
  // to the canonical English fields when a value is missing.
  translations?: Partial<Record<LandingLang, Record<string, unknown>>> | null;
}

interface NewsPost {
  id: string;
  slug?: string;
  title?: string;
  category?: string;
  excerpt?: string;
  cover_image?: string;
  published_on?: string;
  read_minutes?: number;
  status?: string;
  // Which column the post appears in on the public Live Intelligence
  // Feed. Missing values default to 'industry' for back-compat.
  feed_group?: 'regulatory' | 'industry';
  // Optional external source URL. When set on an Industry Trends row,
  // it overrides the auto-generated Google News search link so admins
  // can pin a specific article (e.g. a direct publisher URL).
  external_url?: string;
  // Admin-managed flag: when true, the post sorts above non-pinned
  // posts inside its feed_group column regardless of published_on.
  pinned?: boolean;
  translations?: Partial<Record<LandingLang, Record<string, unknown>>> | null;
}

interface LessonsCounts {
  [courseId: string]: number;
}

// 'home' is a virtual nav target — it has no corresponding section
// element on the page. Clicking it scrolls the document back to the
// very top (same behaviour as clicking the brand mark). It lives at
// the front of NAV_IDS so the user always has an obvious way back to
// the landing view from any deep scroll position.
export type NavId = 'home' | 'training' | 'tips' | 'news' | 'jobs' | 'courses';

export const NAV_IDS: readonly NavId[] = ['home', 'training', 'tips', 'news', 'jobs', 'courses'] as const;

export const navLabel = (id: NavId, t: LandingStrings): string => {
  switch (id) {
    case 'home':
      return t.navHome;
    case 'training':
      return t.navTraining;
    case 'tips':
      return t.navTips;
    case 'news':
      return t.navNews;
    case 'jobs':
      return t.navJobs;
    case 'courses':
      return t.navCourses;
  }
};

const formatDate = (iso: string | undefined, locale: string) => {
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

const formatShortDate = (iso: string | undefined, locale: string) => {
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

const formatPrice = (n: number | undefined, locale: string, freeLabel: string) => {
  if (n == null || n <= 0) return freeLabel;
  // We always display ₹ — locale only changes the digit-group format.
  return `₹${Number(n).toLocaleString(locale)}`;
};

interface AcademyPublicHomeProps {
  // When provided, the Sign In button calls this (ClientApp uses it to
  // open its login modal). When omitted (e.g. /academy standalone), the
  // button is rendered as a link to / so visitors can sign in there.
  onSignInClick?: () => void;
  // Public-only mirror domains (configured via PUBLIC_ONLY_HOSTS env)
  // render the same landing page WITHOUT any "Sign In" CTAs and the
  // bottom call-to-action. The site is read-only for those visitors.
  hideSignIn?: boolean;
  // Server-resolved mirror flag. Page server components pass this
  // down (from getServerIsPublicOnly) so SSR HTML on a mirror host
  // already hides sign-in CTAs — no flash on hydration.
  initialPublicOnly?: boolean;
  // Legacy slots kept so existing callers don't break — they're now
  // ignored because the redesigned header has its own structured nav.
  // We accept them so callers compile until updated.
  headerLeftSlot?: ReactNode;
  headerRightSlot?: ReactNode;
}

export default function AcademyPublicHome({ onSignInClick, hideSignIn = false, initialPublicOnly = false }: AcademyPublicHomeProps = {}) {
  const { t, lang, setLang, locale } = useLandingT();
  // Auto-detect public-only mirror domains. The initial value comes
  // from the server (header tagged by middleware) so SSR HTML is
  // correct on first paint; the hook also re-confirms via cookie
  // after hydration for client-side navigations.
  const isMirror = usePublicOnlyMirror(initialPublicOnly);
  const effectiveHideSignIn = hideSignIn || isMirror;
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [tips, setTips] = useState<SafetyTip[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [lessonsCounts, setLessonsCounts] = useState<LessonsCounts>({});
  const [appSettings, setAppSettings] = useState<AppSettingsBag>({});
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingTraining, setLoadingTraining] = useState(true);
  const [loadingTips, setLoadingTips] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  // Industry Trends column is fed live from Google News so any new
  // food-safety story upstream surfaces here automatically. Stored
  // separately from `newsPosts` (which now feeds Regulatory only).
  const [industryNews, setIndustryNews] = useState<NewsPost[]>([]);
  const [loadingIndustry, setLoadingIndustry] = useState(true);
  // True when the Google News proxy reports no admin-managed
  // keywords are configured. Lets the Industry Trends column show a
  // "No keywords configured yet" message instead of the generic
  // "No industry trends yet" empty state.
  const [industryNoKeywords, setIndustryNoKeywords] = useState(false);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  // Default the highlighted nav item to the first remaining section
  // ('training') now that the hero/'home' section is gone — otherwise
  // the nav bar would briefly highlight nothing on first paint.
  const [activeSection, setActiveSection] = useState<string>('training');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Data load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/academy/courses?status=Active');
        if (!r.ok) throw new Error('failed');
        const j = await r.json();
        const items: Course[] = (Array.isArray(j?.items) ? j.items : []).map((c: Course) => ({
          ...c,
          __source: 'academy' as const,
        }));
        if (cancelled) return;
        const sorted = items.sort((a, b) => {
          const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
          const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
          return tb - ta;
        });
        setCourses(sorted);

        const counts: LessonsCounts = {};
        await Promise.all(
          sorted.slice(0, 60).map(async (c) => {
            try {
              const lr = await fetch(`/api/academy/lessons?course_id=${encodeURIComponent(c.id)}`);
              const jj = await lr.json();
              const arr = Array.isArray(jj?.items) ? jj.items : Array.isArray(jj) ? jj : [];
              counts[c.id] = arr.length;
            } catch {
              counts[c.id] = 0;
            }
          }),
        );
        if (!cancelled) setLessonsCounts(counts);
      } catch (e) {
        if (!cancelled) console.error('AcademyPublicHome courses load failed', e);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    })();

    (async () => {
      try {
        const r = await fetch('/api/training-calendar?public=1');
        const j = await r.json();
        const raw: TrainingSession[] = Array.isArray(j?.items) ? j.items : [];
        const upcoming = raw
          // Treat sessions as visible by default — only hide when an
          // admin explicitly toggles them OFF (isActive === false).
          // The previous strict `=== true` filter silently hid every
          // session whose admin record didn't have the flag set,
          // producing the empty "No live trainings scheduled" state
          // even when valid sessions existed in the DB.
          .filter((t) => t && t.isActive !== false)
          .sort((a, b) => {
            const ta = a.date ? Date.parse(a.date) : 0;
            const tb = b.date ? Date.parse(b.date) : 0;
            return ta - tb; // soonest first
          });
        if (!cancelled) setTrainings(upcoming);
      } catch (e) {
        if (!cancelled) console.error('AcademyPublicHome training load failed', e);
      } finally {
        if (!cancelled) setLoadingTraining(false);
      }
    })();

    (async () => {
      try {
        const r = await fetch('/api/academy/safety-tips?public=1');
        const j = await r.json();
        const arr: SafetyTip[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) setTips(arr);
      } catch (e) {
        if (!cancelled) console.error('AcademyPublicHome tips load failed', e);
      } finally {
        if (!cancelled) setLoadingTips(false);
      }
    })();

    (async () => {
      try {
        const r = await fetch('/api/academy/news-posts?public=1');
        const j = await r.json();
        const arr: NewsPost[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) setNewsPosts(arr);
      } catch (e) {
        if (!cancelled) console.error('AcademyPublicHome news load failed', e);
      } finally {
        if (!cancelled) setLoadingNews(false);
      }
    })();

    // NOTE: The Google News pull for the Industry Trends column
    // intentionally lives in the separate [lang]-keyed effect below
    // so it re-runs when the user toggles language. Doing it here
    // too created a redundant cold-start request and a last-write-
    // wins race against the lang effect that could occasionally
    // overwrite mixed (en+hi) results with single-locale ones.

    (async () => {
      try {
        const r = await fetch('/api/app-settings');
        const j = await r.json();
        if (!cancelled && j && typeof j === 'object') {
          setAppSettings({
            contact_email: j.contact_email,
            contact_phone: j.contact_phone,
            whatsapp_number: j.whatsapp_number,
            default_wa_country_code: j.default_wa_country_code,
          });
        }
      } catch {
        /* contact info is optional — fall back to defaults */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Live Google News pull for the Industry Trends column. Re-runs when
  // the user toggles language so headlines come back in Hindi/English
  // accordingly. Server-side route caches for 10 minutes per (q, hl)
  // so toggling back-and-forth stays cheap.
  useEffect(() => {
    let cancelled = false;
    setLoadingIndustry(true);
    (async () => {
      try {
        // hl=mix: server fetches both en-IN and hi-IN in parallel
        // and merges them by date, so readers always see English +
        // Hindi headlines interleaved regardless of UI language.
        const r = await fetch(
          `/api/academy/google-news?q=${encodeURIComponent(
            'food safety',
          )}&hl=mix&limit=20`,
        );
        const j = await r.json();
        if (!cancelled) setIndustryNoKeywords(j?.empty === true);
        const raw: Array<{
          id?: string;
          title?: string;
          link?: string;
          source?: string;
          published_on?: string;
          image?: string;
        }> = Array.isArray(j?.items) ? j.items : [];
        const mapped: NewsPost[] = raw
          .filter((it) => it && typeof it.title === 'string' && typeof it.link === 'string')
          .map((it, idx) => ({
            id: it.id || it.link || `gnews-${idx}`,
            slug: it.id || it.link || `gnews-${idx}`,
            title: it.title!,
            category: it.source || 'Google News',
            published_on: it.published_on || '',
            feed_group: 'industry' as const,
            external_url: it.link!,
            cover_image: it.image || '',
          }));
        if (!cancelled) setIndustryNews(mapped);
      } catch (e) {
        if (!cancelled) console.error('AcademyPublicHome google-news load failed', e);
      } finally {
        if (!cancelled) setLoadingIndustry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  // ── Scrollspy ─────────────────────────────────────────────────────────────
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Highlight the virtual "Home" tab whenever the user is scrolled
  // near the very top of the document. The IntersectionObserver below
  // can't do this for us because 'home' has no corresponding section
  // element — it's a scroll-to-top target. We listen for scroll and
  // flip activeSection to 'home' when the page is within ~80px of the
  // top, otherwise we let the observer take over.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      if (window.scrollY < 80) setActiveSection('home');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute('data-section');
          if (id) setActiveSection(id);
        }
      },
      // top margin offsets for the sticky nav so a section becomes
      // "active" only once it scrolls under the bar.
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    NAV_IDS.forEach((id) => {
      // 'home' has no corresponding section element — it's a virtual
      // scroll-to-top target. Skip it here so we don't try to observe
      // a ref that intentionally never gets set.
      if (id === 'home') return;
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleNavClick = (id: string) => {
    setDrawerOpen(false);
    // The "News" tab is no longer an in-page anchor — it routes to a
    // dedicated /news page (see components/LatestNewsPage.tsx).
    if (id === 'news') {
      if (typeof window !== 'undefined') window.location.href = '/news';
      return;
    }
    // Jobs is a dedicated public page (components/JobsPage.tsx) — not
    // an in-page anchor on the home screen.
    if (id === 'jobs') {
      if (typeof window !== 'undefined') window.location.href = '/jobs';
      return;
    }
    // "Home" is a virtual nav target — there's no corresponding
    // section element. Scroll the document back to the very top
    // (same behaviour as clicking the brand mark in the header).
    if (id === 'home') {
      setActiveSection('home');
      if (typeof window !== 'undefined') {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
      }
      return;
    }
    const el = sectionRefs.current[id];
    if (!el) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const levels = useMemo(() => {
    const s = new Set(courses.map((c) => c.level).filter(Boolean) as string[]);
    return Array.from(s);
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (levelFilter && c.level !== levelFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(c.title || '').toLowerCase().includes(q) &&
          !(c.short_description || '').toLowerCase().includes(q) &&
          !(c.description || '').toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [courses, search, levelFilter]);


  const waNumber = (appSettings.whatsapp_number || appSettings.contact_phone || '').replace(/[^0-9]/g, '');
  const waCC = (appSettings.default_wa_country_code || '').replace(/[^0-9]/g, '');
  const waHref = waNumber
    ? `https://wa.me/${waCC ? waCC + waNumber : waNumber}`
    : null;
  const contactEmail = appSettings.contact_email || 'hello@haccppro.com';

  const handleSignIn = () => {
    if (onSignInClick) onSignInClick();
    else window.location.href = '/';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        [data-fade-section] {
          animation: fadeUp 0.6s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-fade-section] { animation: none; }
        }
      `}</style>

      <TopBar
        activeSection={activeSection}
        onNav={handleNavClick}
        onSignIn={handleSignIn}
        hideSignIn={effectiveHideSignIn}
        onOpenDrawer={() => setDrawerOpen(true)}
        waHref={waHref}
        t={t}
        lang={lang}
        onChangeLang={setLang}
      />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeSection={activeSection}
        onNav={handleNavClick}
        hideSignIn={effectiveHideSignIn}
        onSignIn={handleSignIn}
        waHref={waHref}
        t={t}
        lang={lang}
        onChangeLang={setLang}
      />

      <main>
        {/* HOME / HERO section was removed per user request — the public
            home page now opens directly on the live training calendar.
            The logo in the top-bar still returns visitors to the top of
            the document via window.scrollTo({ top: 0 }). */}

        {/* TRAINING */}
        <Section
          id="training"
          refSetter={(el) => (sectionRefs.current.training = el)}
          className="bg-white border-t border-slate-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20" data-fade-section>
            <SectionHeader
              eyebrow={t.trainingEyebrow}
              title={t.trainingTitle}
              subtitle={t.trainingSubtitle}
            />
            {loadingTraining ? (
              <LoadingRow label={t.loadingSessions} />
            ) : trainings.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="w-8 h-8" />}
                title={t.noTrainingsTitle}
                description={t.noTrainingsBody}
              />
            ) : (
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {trainings.slice(0, 6).map((session) => (
                  <TrainingCard key={session.id} session={session} t={t} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* TIPS */}
        <Section
          id="tips"
          refSetter={(el) => (sectionRefs.current.tips = el)}
          className="bg-gradient-to-b from-slate-50 to-white border-t border-slate-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20" data-fade-section>
            <SectionHeader
              eyebrow={t.tipsEyebrow}
              title={t.tipsTitle}
              subtitle={t.tipsSubtitle}
            />
            {loadingTips ? (
              <LoadingRow label={t.loadingTips} />
            ) : tips.length === 0 ? (
              <EmptyState
                icon={<Lightbulb className="w-8 h-8" />}
                title={t.noTipsTitle}
                description={t.noTipsBody}
              />
            ) : (
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tips.slice(0, 6).map((tip) => (
                  <TipCard key={tip.id} tip={tip} t={t} lang={lang} />
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* NEWS — Live Intelligence Feed */}
        <Section
          id="news"
          refSetter={(el) => (sectionRefs.current.news = el)}
          className="bg-white border-t border-slate-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20" data-fade-section>
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black uppercase tracking-[0.25em]">
                <Bell className="w-3.5 h-3.5" />
                {t.newsEyebrow}
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                {t.newsTitle}
              </h2>
              {t.newsSubtitle && (
                <p className="mt-3 text-base text-slate-500 leading-relaxed">{t.newsSubtitle}</p>
              )}
            </div>

            {(() => {
              // Pinned posts float to the top of their column regardless of
               // published_on (admin-managed via the news editor "Pin to top"
               // toggle). Within pinned vs non-pinned groups, ordering still
               // falls back to published_on desc — preserving the historical
               // behaviour for posts without a pin.
              const sortPinnedThenDateDesc = (a: NewsPost, b: NewsPost) => {
                const pa = a.pinned ? 1 : 0;
                const pb = b.pinned ? 1 : 0;
                if (pa !== pb) return pb - pa;
                const da = a.published_on ? Date.parse(a.published_on) : 0;
                const db = b.published_on ? Date.parse(b.published_on) : 0;
                return db - da;
              };
              // CATEGORY drives column placement: any article whose
              // category text matches /regulat/i routes to the
              // Regulatory column. We still respect the legacy
              // feed_group field so older rows that haven't been
              // re-saved keep their existing column.
              const isRegulatoryPost = (n: NewsPost) => {
                const c = (n.category || '').toLowerCase();
                if (c.includes('regulat')) return true;
                if (c === 'general' || c === 'industry') return false;
                return n.feed_group === 'regulatory';
              };
              const regulatory = newsPosts
                .filter(isRegulatoryPost)
                .sort(sortPinnedThenDateDesc)
                .slice(0, 12);
              // Industry column is primarily driven by the live Google
              // News RSS feed (see effect that fetches
              // /api/academy/google-news). Any admin-pinned posts whose
              // feed_group === 'industry' still float to the top so
              // editors can hand-curate flagship stories alongside the
              // live feed; un-pinned admin industry posts are
              // intentionally suppressed here to keep the column truly
              // "live".
              // Include ALL admin-managed posts in the General/Industry
              // column (not just pinned ones). Pinned posts still float
              // to the top via sortPinnedThenDateDesc; un-pinned admin
              // posts now appear interleaved with the live Google News
              // feed by published_on, so a manually-added "General"
              // article is visible on the public home immediately.
              const adminIndustry = newsPosts
                .filter((n) => !isRegulatoryPost(n))
                .sort(sortPinnedThenDateDesc);
              const adminPinnedIndustry = adminIndustry.filter((n) => n.pinned);
              // Dedupe industryNews against adminIndustry by external
              // URL: every live Google News item is auto-saved server-
              // side into academy_news_posts (so it can be edited /
              // hidden by admins), which means it would otherwise
              // appear twice — once via the live RSS pull and once via
              // the saved-posts pull. Keep the saved-posts copy since
              // it carries pin/edit state.
              const adminIndustryUrlSet = new Set(
                adminIndustry
                  .map((n) => (n.external_url || '').trim())
                  .filter((u) => u.length > 0),
              );
              const dedupedIndustryNews = industryNews.filter((n) => {
                const u = (n.external_url || '').trim();
                return !u || !adminIndustryUrlSet.has(u);
              });
              const industry = [...adminIndustry, ...dedupedIndustryNews].slice(0, 12);
              // Previously: if BOTH columns were empty we replaced the
              // whole grid with a single global empty state. That hid
              // the section entirely whenever Google News briefly
              // failed AND the admin hadn't posted any regulatory
              // updates. Now each column renders its own emptyLabel
              // (handled inside NewsFeedColumn), so visitors always
              // see the section structure and a clear per-column
              // status — never the misleading "No news posts yet"
              // wall covering live data that just hasn't loaded yet.
              return (
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <NewsFeedColumn
                    tone="regulatory"
                    icon={<Gavel className="w-4 h-4" />}
                    title={t.newsRegulatoryTitle}
                    posts={regulatory}
                    loading={loadingNews}
                    emptyLabel={t.newsRegulatoryEmpty}
                    newPillLabel={t.newsNewPill}
                    untitledLabel={t.untitledArticle}
                    viewAllLabel={t.newsViewAll}
                    viewAllAriaLabel={t.newsViewAllAria}
                    lang={lang}
                    locale={locale}
                  />
                  <NewsFeedColumn
                    tone="industry"
                    icon={<BookOpen className="w-4 h-4" />}
                    title={t.newsIndustryTitle}
                    posts={industry}
                    loading={loadingIndustry}
                    emptyLabel={
                      industryNoKeywords && adminPinnedIndustry.length === 0
                        ? t.newsIndustryEmptyNoKeywords
                        : t.newsIndustryEmpty
                    }
                    newPillLabel={t.newsNewPill}
                    viewAllLabel={t.newsViewAll}
                    viewAllAriaLabel={t.newsViewAllAria}
                    untitledLabel={t.untitledArticle}
                    lang={lang}
                    locale={locale}
                  />
                </div>
              );
            })()}
          </div>
        </Section>

        {/* COURSES */}
        <Section
          id="courses"
          refSetter={(el) => (sectionRefs.current.courses = el)}
          className="bg-gradient-to-b from-slate-50 to-white border-t border-slate-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20" data-fade-section>
            <SectionHeader
              eyebrow={t.coursesEyebrow}
              title={t.coursesTitle}
              subtitle={t.coursesSubtitle}
            />
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.searchCourses}
                  className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-400 outline-none bg-white"
                />
              </div>
              {levels.length > 0 && (
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none bg-white"
                >
                  <option value="">{t.allLevels}</option>
                  {levels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {loadingCourses ? (
              <LoadingRow label={t.loadingCourses} />
            ) : filteredCourses.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-8 h-8" />}
                title={t.noCoursesTitle}
                description={t.noCoursesBody}
              />
            ) : (
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    lessonsCount={lessonsCounts[c.id]}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* WHY HACCP PRO */}
        <section className="bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20" data-fade-section>
            <SectionHeader
              eyebrow={t.whyEyebrow}
              title={t.whyTitle}
              subtitle={t.whySubtitle}
            />
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <FeatureTile
                icon={<ClipboardCheck className="w-6 h-6" />}
                title={t.featSmartAuditsTitle}
                body={t.featSmartAuditsBody}
              />
              <FeatureTile
                icon={<GraduationCap className="w-6 h-6" />}
                title={t.featTrainingTitle}
                body={t.featTrainingBody}
              />
              <FeatureTile
                icon={<FileBadge className="w-6 h-6" />}
                title={t.featRecordsTitle}
                body={t.featRecordsBody}
              />
              <FeatureTile
                icon={<ScanLine className="w-6 h-6" />}
                title={t.featRealtimeTitle}
                body={t.featRealtimeBody}
              />
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 lg:pb-20" data-fade-section>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-10 sm:p-14 text-white shadow-2xl shadow-indigo-500/30">
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-violet-300/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                    <Award className="w-3.5 h-3.5" /> {t.ctaPill}
                  </span>
                  <h3 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                    {t.ctaTitle}
                  </h3>
                  <p className="mt-3 text-indigo-100 text-base max-w-2xl">
                    {t.ctaSubtitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-start lg:justify-end">
                  {!effectiveHideSignIn && (
                    <button
                      type="button"
                      onClick={handleSignIn}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-indigo-700 font-extrabold text-sm hover:bg-indigo-50 transition-colors shadow-lg"
                    >
                      {t.signIn} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  {waHref && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/15 text-white font-extrabold text-sm hover:bg-white/25 transition-colors backdrop-blur-sm border border-white/20"
                    >
                      <MessageCircle className="w-4 h-4" /> {t.talkToUs}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter
        contactEmail={contactEmail}
        contactPhone={appSettings.contact_phone}
        waHref={waHref}
        onNav={handleNavClick}
        t={t}
      />
    </div>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────
export function TopBar({
  activeSection,
  onNav,
  onSignIn,
  hideSignIn = false,
  onOpenDrawer,
  waHref,
  t,
  lang,
  onChangeLang,
}: {
  activeSection: string;
  onNav: (id: string) => void;
  onSignIn: () => void;
  hideSignIn?: boolean;
  onOpenDrawer: () => void;
  waHref: string | null;
  t: LandingStrings;
  lang: LandingLang;
  onChangeLang: (l: LandingLang) => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => {
            // The 'home' anchor no longer exists since the hero section
            // was removed; just scroll the document back to the top.
            if (typeof window !== 'undefined') {
              const prefersReduced = window.matchMedia(
                '(prefers-reduced-motion: reduce)',
              ).matches;
              window.scrollTo({
                top: 0,
                behavior: prefersReduced ? 'auto' : 'smooth',
              });
            }
          }}
          className="flex items-center gap-3 group shrink-0"
          aria-label={t.haccpProHome}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shadow-md shadow-slate-900/20 group-hover:bg-slate-800 transition-colors">
            HP
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-sm font-extrabold tracking-tight">
              HACCP <span className="text-indigo-600">PRO</span>
            </div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              {t.brandTagline}
            </div>
          </div>
        </button>

        <nav className="hidden lg:flex items-center gap-1 ml-6">
          {NAV_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onNav(id)}
              className={`px-3 py-2 rounded-lg text-[12px] font-extrabold uppercase tracking-wider transition-colors ${
                activeSection === id
                  ? 'text-indigo-700 bg-indigo-50'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              {navLabel(id, t)}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        <LanguageSwitcher lang={lang} onChange={onChangeLang} t={t} />

        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-extrabold uppercase tracking-widest transition-colors"
            aria-label={t.whatsapp}
          >
            <MessageCircle className="w-4 h-4" /> {t.whatsapp}
          </a>
        )}

        {!hideSignIn && (
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] sm:text-xs font-extrabold uppercase tracking-widest shadow-md shadow-indigo-500/30 transition-colors"
          >
            {t.signIn}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenDrawer}
          className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          aria-label={t.openMenu}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

// ── Language picker ───────────────────────────────────────────────────────
// Minimal native <select> wrapped to look like the rest of the chrome —
// keeps screen-reader behaviour for free and doesn't introduce a new
// dropdown component just for two options.
function LanguageSwitcher({
  lang,
  onChange,
  t,
  variant = 'pill',
}: {
  lang: LandingLang;
  onChange: (l: LandingLang) => void;
  t: LandingStrings;
  variant?: 'pill' | 'block';
}) {
  const baseClasses =
    variant === 'pill'
      ? 'inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-extrabold uppercase tracking-widest transition-colors'
      : 'w-full inline-flex items-center justify-between gap-2 px-3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold uppercase tracking-widest';
  return (
    <label className={baseClasses} aria-label={t.language}>
      <Globe className="w-4 h-4" />
      <span className="sr-only">{t.language}</span>
      <select
        value={lang}
        onChange={(e) => onChange(e.target.value as LandingLang)}
        className="bg-transparent border-0 outline-none text-[11px] font-extrabold uppercase tracking-widest text-slate-700 cursor-pointer pr-1"
      >
        {LANDING_LANGUAGES.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MobileDrawer({
  open,
  onClose,
  activeSection,
  onNav,
  onSignIn,
  hideSignIn = false,
  waHref,
  t,
  lang,
  onChangeLang,
}: {
  open: boolean;
  onClose: () => void;
  activeSection: string;
  onNav: (id: string) => void;
  onSignIn: () => void;
  hideSignIn?: boolean;
  waHref: string | null;
  t: LandingStrings;
  lang: LandingLang;
  onChangeLang: (l: LandingLang) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <span className="text-sm font-extrabold tracking-tight">{t.menu}</span>
          <button
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label={t.closeMenu}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto">
          {NAV_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onNav(id)}
              className={`w-full text-left px-3 py-3 rounded-xl text-sm font-extrabold uppercase tracking-wider mb-1 flex items-center justify-between ${
                activeSection === id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {navLabel(id, t)}
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 space-y-2">
          <LanguageSwitcher lang={lang} onChange={onChangeLang} t={t} variant="block" />
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-extrabold uppercase tracking-widest"
            >
              <MessageCircle className="w-4 h-4" /> {t.whatsapp}
            </a>
          )}
          {!hideSignIn && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignIn();
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-xs font-extrabold uppercase tracking-widest shadow-md shadow-indigo-500/30"
            >
              {t.signIn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable section building blocks ──────────────────────────────────────
function Section({
  id,
  refSetter,
  className,
  children,
}: {
  id: string;
  refSetter: (el: HTMLElement | null) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-section={id}
      ref={refSetter}
      className={`scroll-mt-20 ${className || ''}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <span className="inline-block text-[11px] font-black uppercase tracking-[0.25em] text-indigo-600">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base text-slate-500 leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {label}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-10 max-w-md mx-auto text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-12 px-6">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white text-slate-400 flex items-center justify-center shadow-sm border border-slate-200">
        {icon}
      </div>
      <p className="mt-4 text-sm font-extrabold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// TrustStrip and HeroIllustration were rendered exclusively inside the
// removed HOME / HERO section, so their definitions were deleted along
// with the section. TipReaderPage has its own (separately maintained)
// TrustStrip — that one is intentionally untouched.

// ── Cards ──────────────────────────────────────────────────────────────────
function TrainingCard({
  session,
  t,
  locale,
}: {
  session: TrainingSession;
  t: LandingStrings;
  locale: string;
}) {
  const fee = typeof session.courseFee === 'number' ? session.courseFee : undefined;
  const disc = typeof session.discount === 'number' ? session.discount : 0;
  const finalFee = fee != null && disc > 0 ? Math.max(0, fee - disc) : fee;
  const titleParts = [session.topic, session.subTopic].filter(Boolean);
  const title = titleParts.join(' — ') || t.untitledTraining;
  return (
    <Link
      href={`/training-register/${encodeURIComponent(session.id)}`}
      className="group bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-indigo-100 to-violet-100 overflow-hidden">
        {session.thumbnailImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.thumbnailImage}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-indigo-300">
            <CalendarDays className="w-12 h-12" />
          </div>
        )}
        {session.mode && (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-white/90 text-[10px] font-black uppercase tracking-widest text-slate-700">
            {session.mode}
          </span>
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-2">
          {title}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-1.5 text-[12px] font-bold text-slate-500">
          {session.date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-500" /> {formatDate(session.date, locale)}
            </span>
          )}
          {(session.startTime || session.endTime) && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              {[session.startTime, session.endTime].filter(Boolean).join(' – ')}
            </span>
          )}
          {session.trainer && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-500" /> {t.cardTrainerLabel}: {session.trainer}
            </span>
          )}
          {session.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" /> {session.location}
            </span>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="inline-flex items-baseline gap-2 text-sm font-extrabold text-slate-900">
            {formatPrice(finalFee, locale, t.free)}
            {fee != null && disc > 0 && (
              <span className="text-[11px] font-bold text-slate-400 line-through">
                {formatPrice(fee, locale, t.free)}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 group-hover:gap-2 transition-all">
            {t.cardRegister} <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// Public-facing safety tip card. Redesigned to match the editorial
// "protocol card" pattern: cover image up top with a category pill
// pinned to the bottom-left of the image, then a clean white body
// with bold title, gray description, and a single emerald CTA link.
// The old date / read-minutes footer was removed so the card reads
// as one focused call-to-action.
function TipCard({
  tip,
  t,
  lang,
}: {
  tip: SafetyTip;
  t: LandingStrings;
  lang: LandingLang;
}) {
  const slug = tip.slug || tip.id;
  const title = localizedField(tip, lang, 'title') || t.untitledTip;
  const excerpt = localizedField(tip, lang, 'excerpt');
  const body = localizedField(tip, lang, 'body');
  const teaser = excerpt || (body ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) : '');
  const category = localizedField(tip, lang, 'category');
  const cover = normalizeImageUrl(tip.cover_image);
  const href = `/tips/${encodeURIComponent(slug)}`;

  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[16/10] bg-gradient-to-b from-slate-100 to-slate-200 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-emerald-500">
            <Lightbulb className="w-10 h-10" />
          </div>
        )}
        {/* Category pill anchored to the bottom-left of the image, in
            an emerald rounded badge to mirror the reference design. */}
        <span className="absolute bottom-3 left-3 inline-flex items-center px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-md">
          {category || t.tipsEyebrow}
        </span>
      </div>
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        <h3 className="font-extrabold text-slate-900 text-lg leading-snug line-clamp-2">
          {title}
        </h3>
        {teaser && (
          <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-3">{teaser}</p>
        )}
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 group-hover:gap-2 transition-all">
          {t.tipReadFull} <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}

// Live Intelligence Feed — column card (Regulatory or Industry).
// Renders a header pill + a vertical list of compact NewsFeedRow items.
// Empty/loading states are handled inline so the other column can still
// render even if this one has nothing to show.
function NewsFeedColumn({
  tone,
  icon,
  title,
  posts,
  loading,
  emptyLabel,
  newPillLabel,
  untitledLabel,
  viewAllLabel,
  viewAllAriaLabel,
  lang,
  locale,
}: {
  tone: 'regulatory' | 'industry';
  icon: ReactNode;
  title: string;
  posts: NewsPost[];
  loading: boolean;
  emptyLabel: string;
  newPillLabel: string;
  untitledLabel: string;
  viewAllLabel: string;
  viewAllAriaLabel: string;
  lang: LandingLang;
  locale: string;
}) {
  const isIndustry = tone === 'industry';
  const headerPill =
    tone === 'regulatory'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
      : 'bg-emerald-50 text-emerald-700 border-emerald-100';
  const viewAllClass =
    tone === 'regulatory'
      ? 'text-indigo-700 hover:text-indigo-900 focus-visible:ring-indigo-500'
      : 'text-emerald-700 hover:text-emerald-900 focus-visible:ring-emerald-500';

  const commonList = (
    <div className="mt-2 divide-y divide-slate-100">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="py-4 animate-pulse">
            <div className="h-2.5 w-24 bg-slate-200 rounded" />
            <div className="mt-2 h-4 w-5/6 bg-slate-200 rounded" />
            <div className="mt-2 h-3 w-1/3 bg-slate-100 rounded" />
          </div>
        ))
      ) : posts.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <Newspaper className="w-7 h-7 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-bold">{emptyLabel}</p>
        </div>
      ) : (
        posts.map((p) => (
          <NewsFeedRow
            key={p.id}
            post={p}
            tone={tone}
            newPillLabel={newPillLabel}
            untitledLabel={untitledLabel}
            lang={lang}
            locale={locale}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-4 border-b border-slate-100">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-[0.18em] ${headerPill}`}
        >
          {icon}
          {title}
        </span>
        <Link
          href="/news"
          aria-label={viewAllAriaLabel}
          className={`inline-flex items-center gap-1 text-xs font-bold rounded-md px-1.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${viewAllClass}`}
        >
          {viewAllLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {loading ? (
        <div className="mt-2 divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-4 animate-pulse">
              <div className="h-2.5 w-24 bg-slate-200 rounded" />
              <div className="mt-2 h-4 w-5/6 bg-slate-200 rounded" />
              <div className="mt-2 h-3 w-1/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="mt-2 py-10 text-center text-slate-400">
          <Newspaper className="w-7 h-7 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-bold">{emptyLabel}</p>
        </div>
      ) : (
        // Bottom-to-top auto scroll: the post list is duplicated and
        // translated upward by -50% on a loop so the latest article
        // (top of the list) is always the first thing a new visitor
        // sees, then older items drift up into view. Hovering pauses
        // the scroll (see .news-marquee class in globals.css). For
        // very short lists (<= 4 items) we skip the marquee since
        // there's nothing to scroll to.
        posts.length <= 4 ? (
          <div className="mt-2 divide-y divide-slate-100">
            {posts.map((p) => (
              <NewsFeedRow
                key={p.id}
                post={p}
                tone={tone}
                newPillLabel={newPillLabel}
                untitledLabel={untitledLabel}
                lang={lang}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <div
            className="news-marquee mt-2 relative overflow-hidden"
            style={{
              maxHeight: '380px',
              maskImage:
                'linear-gradient(to bottom, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
            }}
          >
            <div className="news-marquee-track">
              <div className="divide-y divide-slate-100">
                {posts.map((p) => (
                  <NewsFeedRow
                    key={`a-${p.id}`}
                    post={p}
                    tone={tone}
                    newPillLabel={newPillLabel}
                    untitledLabel={untitledLabel}
                    lang={lang}
                    locale={locale}
                  />
                ))}
              </div>
              <div className="divide-y divide-slate-100" aria-hidden="true">
                {posts.map((p) => (
                  <NewsFeedRow
                    key={`b-${p.id}`}
                    post={p}
                    tone={tone}
                    newPillLabel={newPillLabel}
                    untitledLabel={untitledLabel}
                    lang={lang}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// Single article row inside a Live Intelligence Feed column. Shows the
// uppercase category eyebrow, headline, published date and a green
// "NEW" pill when published_on is within the last 14 days.
function NewsFeedRow({
  post,
  tone,
  newPillLabel,
  untitledLabel,
  lang,
  locale,
}: {
  post: NewsPost;
  tone: 'regulatory' | 'industry';
  newPillLabel: string;
  untitledLabel: string;
  lang: LandingLang;
  locale: string;
}) {
  const slug = post.slug || post.id;
  const title = localizedField(post, lang, 'title') || untitledLabel;
  const category = localizedField(post, lang, 'category');
  const isNew = (() => {
    if (!post.published_on) return false;
    const ts = Date.parse(post.published_on);
    if (Number.isNaN(ts)) return false;
    const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return ageDays >= 0 && ageDays <= 14;
  })();
  const eyebrowTone =
    tone === 'regulatory' ? 'text-indigo-600' : 'text-emerald-600';

  // Industry Trends rows route OUT to Google News (or the admin-pinned
  // external_url) and open in a new tab. Regulatory Updates stay
  // internal so we own the legal/compliance narrative end-to-end.
  const isExternal = tone === 'industry';
  const externalHref = isExternal
    ? post.external_url && /^https?:\/\//i.test(post.external_url)
      ? post.external_url
      : `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=${
          lang === 'hi' ? 'hi-IN' : 'en-US'
        }`
    : null;

  const handleClick = () => {
    // Fire-and-forget click ping so admins can see which Live
    // Intelligence Feed articles are pulling traffic. We don't await
    // the response — navigation continues even if the ping fails or
    // the user is offline. keepalive lets the request complete after
    // the page unloads. Fired for both internal Regulatory rows and
    // external Industry rows so totals reflect real reader interest
    // either way.
    try {
      const payload = JSON.stringify({
        post_id: post.id,
        slug,
        feed_group: tone,
        lang,
      });
      fetch('/api/academy/news-clicks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Ignore — analytics must never block navigation.
    }
  };

  // Compact thumbnail on the left edge of the row. Real publisher
  // hero images render edge-to-edge; Google s2 favicons render
  // centered on a branded gradient, with a stepped fallback to a
  // higher-res favicon and finally hidden if both fetches fail.
  const coverImage =
    post.cover_image && post.cover_image.trim() ? post.cover_image : '';
  const isFavicon = /\/s2\/favicons\b/i.test(coverImage);
  const faviconHiRes = isFavicon
    ? coverImage.replace(/([?&]sz=)\d+/i, '$1256')
    : coverImage;
  const thumbBg =
    tone === 'regulatory'
      ? 'bg-gradient-to-br from-indigo-50 to-violet-100'
      : 'bg-gradient-to-br from-emerald-50 to-teal-100';

  const commonInner = (
    <>
      {isNew && (
        <span className="absolute top-3 right-2 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
          {newPillLabel}
        </span>
      )}
      <div className="flex items-start gap-3">
        {coverImage && (
          <div
            className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex items-center justify-center ${thumbBg}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isFavicon ? faviconHiRes : coverImage}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className={
                isFavicon
                  ? 'max-h-10 max-w-[70%] object-contain'
                  : 'w-full h-full object-cover'
              }
              onError={(ev) => {
                const el = ev.currentTarget as HTMLImageElement;
                if (isFavicon && el.src !== coverImage) {
                  el.src = coverImage;
                } else {
                  el.style.display = 'none';
                }
              }}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {category && (
            <div
              className={`text-[10px] font-black uppercase tracking-[0.18em] ${eyebrowTone} pr-12`}
            >
              {category}
            </div>
          )}
          <h3 className="mt-1 font-extrabold text-slate-900 text-[15px] leading-snug line-clamp-2 group-hover:text-indigo-700 pr-12">
            {title}
          </h3>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {formatShortDate(post.published_on, locale)}
            </div>
            {isExternal && (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 group-hover:text-emerald-700">
                Google News <ExternalLink className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const className =
    'group relative block py-4 -mx-2 px-2 rounded-lg hover:bg-slate-50 transition-colors';

  if (externalHref) {
    // Route every external row through our /n/<token> share landing
    // so the visitor sees the training-ad interstitial before being
    // redirected to the publisher — same funnel as the share / copy
    // buttons on /news. A click and a shared URL behave identically.
    const buildShareUrl = async (): Promise<string> => {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'https://haccp.pro';
      let shareUrl = externalHref!;
      try {
        const r = await fetch('/api/news/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            link: externalHref,
            title,
            image: post.cover_image || '',
            source: post.category || '',
          }),
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j && typeof j.token === 'string' && j.token.length > 0) {
            shareUrl = `${origin}/n/${j.token}`;
          }
        }
      } catch {
        /* fall through to direct externalHref */
      }
      return shareUrl;
    };
    const handleAdvertisedClick = (e: React.MouseEvent) => {
      e.preventDefault();
      handleClick();
      // Open the new tab SYNCHRONOUSLY so popup blockers don't kill
      // it — buildShareUrl() is async and any window.open after the
      // await loses the user-gesture permission. Point the
      // placeholder tab at the publisher up front so a network
      // failure in the share-mint step still lands somewhere useful.
      const win = window.open(externalHref!, '_blank', 'noopener,noreferrer');
      buildShareUrl()
        .then((shareUrl) => {
          if (win && !win.closed) {
            try {
              win.location.replace(shareUrl);
            } catch {
              /* cross-origin / closed — leave the tab on externalHref */
            }
          }
        })
        .catch(() => {
          /* fall back to externalHref already loaded in the new tab */
        });
    };
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleAdvertisedClick}
        className={className}
      >
        {commonInner}
      </a>
    );
  }

  return (
    <Link
      href={`/news/${encodeURIComponent(slug)}`}
      onClick={handleClick}
      className={className}
    >
      {commonInner}
    </Link>
  );
}

function CourseCard({
  course,
  lessonsCount,
  t,
  locale,
}: {
  course: Course;
  lessonsCount?: number;
  t: LandingStrings;
  locale: string;
}) {
  const lessons = lessonsCount ?? 0;
  const students = course.enrolment_count ?? 0;
  const rating = course.rating ?? 0;
  const hasDiscount =
    typeof course.discount_price === 'number' &&
    course.discount_price >= 0 &&
    typeof course.price === 'number' &&
    course.price > course.discount_price;
  const finalPrice = hasDiscount ? course.discount_price! : course.price ?? 0;
  const href = `/courses/${encodeURIComponent(course.id)}?source=academy`;

  return (
    <Link
      href={href}
      className="group text-left bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
        {course.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail}
            alt={course.title || t.untitledCourse}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <BookOpen className="w-12 h-12" />
          </div>
        )}
        {course.level && (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-white/90 text-[10px] font-black uppercase tracking-widest text-slate-700">
            {course.level}
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-2 min-h-[2.6rem]">
          {course.title || t.untitledCourse}
        </h3>

        <div className="mt-3 flex items-center gap-4 text-[12px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> {t.cardLessonsLabel} : {lessons}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {t.cardStudentsLabel} : {students}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="inline-flex items-baseline gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-md">
            <span className="text-sm font-extrabold">{formatPrice(finalPrice, locale, t.free)}</span>
            {hasDiscount && (
              <span className="text-[11px] font-bold text-slate-400 line-through">
                {formatPrice(course.price, locale, t.free)}
              </span>
            )}
          </div>
          <span
            title={`${rating || 0} / 5`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[12px] font-extrabold"
          >
            {rating ? rating.toFixed(1) : '—'}
          </span>
        </div>
      </div>
    </Link>
  );
}

function FeatureTile({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-indigo-200 hover:shadow-lg transition-all">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-extrabold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="w-9 h-9 inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-indigo-500 text-slate-300 hover:text-white border border-white/10 transition-colors"
    >
      {children}
    </a>
  );
}

export function SiteFooter({
  contactEmail,
  contactPhone,
  waHref,
  onNav,
  t,
}: {
  contactEmail: string;
  contactPhone?: string;
  waHref: string | null;
  onNav: (id: string) => void;
  t: LandingStrings;
}) {
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur text-white flex items-center justify-center font-extrabold text-xs border border-white/10">
              HP
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight text-white">
                HACCP <span className="text-indigo-400">PRO</span>
              </div>
              <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                {t.brandTagline}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400 leading-relaxed">
            {t.footerTagline}
          </p>
        </div>

        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-4">
            {t.footerQuickLinks}
          </div>
          <ul className="space-y-2">
            {NAV_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onNav(id)}
                  className="text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  {navLabel(id, t)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-4">
            {t.footerContact}
          </div>
          <ul className="space-y-3 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 mt-0.5 text-indigo-400" />
              <a
                href={`mailto:${contactEmail}`}
                className="hover:text-white font-bold break-all"
              >
                {contactEmail}
              </a>
            </li>
            {contactPhone && (
              <li className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 mt-0.5 text-indigo-400" />
                <a
                  href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`}
                  className="hover:text-white font-bold"
                >
                  {contactPhone}
                </a>
              </li>
            )}
            {waHref && (
              <li className="flex items-start gap-2">
                <MessageCircle className="w-3.5 h-3.5 mt-0.5 text-emerald-400" />
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white font-bold"
                >
                  {t.whatsapp}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-4">
            {t.footerLegal}
          </div>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/legal/privacy" className="hover:text-white font-bold text-slate-300">
                {t.footerPrivacy}
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="hover:text-white font-bold text-slate-300">
                {t.footerTerms}
              </Link>
            </li>
            <li>
              <Link href="/legal/security" className="hover:text-white font-bold text-slate-300">
                {t.footerSecurity}
              </Link>
            </li>
          </ul>
          <div className="mt-6 text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-3">
            {t.footerFollow}
          </div>
          <div className="flex items-center gap-2">
            <SocialIcon href="https://www.linkedin.com/" label="LinkedIn">
              <Linkedin className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://twitter.com/" label="Twitter / X">
              <Twitter className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://www.facebook.com/" label="Facebook">
              <Facebook className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://www.instagram.com/" label="Instagram">
              <Instagram className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://www.youtube.com/" label="YouTube">
              <Youtube className="w-4 h-4" />
            </SocialIcon>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
          <span>{t.footerCopyright(new Date().getFullYear())}</span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {t.footerTrustedBy}
          </span>
        </div>
      </div>
    </footer>
  );
}
