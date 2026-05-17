'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  ExternalLink,
  Gavel,
  GraduationCap,
  Copy,
  Loader2,
  Newspaper,
  Pin,
  Search,
  Share2,
} from 'lucide-react';
import { type LandingLang, localizedField, useLandingT } from '@/lib/landingI18n';
import PublicSiteShell from './PublicSiteShell';
import CourseRibbon from './CourseRibbon';
import FloatingCourses from './FloatingCourses';

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
  feed_group?: 'regulatory' | 'industry';
  external_url?: string;
  // When 'link', the card click routes through our /n/<token> share
  // landing so visitors see the training-ad interstitial before being
  // redirected to the external publisher (Google-News-style). 'text'
  // (or absent) keeps the legacy behavior: open the internal article
  // reader for in-house posts, or open the publisher directly for
  // Industry Trends auto-links.
  content_type?: 'text' | 'link';
  pinned?: boolean;
  translations?: Partial<Record<LandingLang, Record<string, unknown>>> | null;
}

const formatLongDate = (iso: string | undefined, locale: string) => {
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

const isWithinDays = (iso: string | undefined, days: number) => {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= days;
};

const sortPinnedThenDateDesc = (a: NewsPost, b: NewsPost) => {
  const pa = a.pinned ? 1 : 0;
  const pb = b.pinned ? 1 : 0;
  if (pa !== pb) return pb - pa;
  const da = a.published_on ? Date.parse(a.published_on) : 0;
  const db = b.published_on ? Date.parse(b.published_on) : 0;
  return db - da;
};

const PAGE_SIZE = 12;

export default function LatestNewsPage({ initialPublicOnly = false }: { initialPublicOnly?: boolean } = {}) {
  const { t, lang, locale } = useLandingT();
  const [regulatoryPosts, setRegulatoryPosts] = useState<NewsPost[]>([]);
  // Admin-managed posts whose feed_group is "industry" (a.k.a "General").
  // Kept separate from the live Google News results so they merge cleanly
  // — pinned ones float to the top, the rest sort by published_on.
  const [manualIndustryPosts, setManualIndustryPosts] = useState<NewsPost[]>([]);
  const [industryPosts, setIndustryPosts] = useState<NewsPost[]>([]);
  const [loadingRegulatory, setLoadingRegulatory] = useState(true);
  const [loadingIndustry, setLoadingIndustry] = useState(true);
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [regulatoryVisible, setRegulatoryVisible] = useState(PAGE_SIZE);
  const [industryVisible, setIndustryVisible] = useState(PAGE_SIZE);
  // True when the Google News proxy reports that no admin-managed
  // keywords are configured. Used to swap the generic "no matching
  // industry news" empty state for an explicit "No keywords
  // configured yet" message.
  const [industryNoKeywords, setIndustryNoKeywords] = useState(false);
  const [regulatoryLoadingMore, setRegulatoryLoadingMore] = useState(false);
  const [industryLoadingMore, setIndustryLoadingMore] = useState(false);
  // Per-article click counts shown on each news card. Pulled from
  // /api/academy/news-clicks GET (which aggregates the same events
  // we POST when a card is opened) and refreshed periodically so
  // the visible count grows as readers click through.
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/academy/news-clicks', { cache: 'no-store' });
        const j = await r.json();
        const counts =
          j && typeof j === 'object' && j.counts && typeof j.counts === 'object'
            ? (j.counts as Record<string, number>)
            : {};
        if (!cancelled) setClickCounts(counts);
      } catch {
        /* leave existing counts in place on transient errors */
      }
    };
    load();
    // Light refresh cadence — keeps counts feeling live without
    // hammering the endpoint.
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  const regulatoryLoadMoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const industryLoadMoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/academy/news-posts?public=1');
        const j = await r.json();
        const arr: NewsPost[] = Array.isArray(j?.items) ? j.items : [];
        if (!cancelled) {
          // CATEGORY drives column placement: any article whose
          // category text matches /regulat/i routes to the Regulatory
          // column. We still respect the legacy feed_group field so
          // older rows that haven't been re-saved keep their column.
          const isRegulatory = (n: NewsPost) => {
            const c = (n.category || '').toLowerCase();
            if (c.includes('regulat')) return true;
            if (c === 'general' || c === 'industry') return false;
            return n.feed_group === 'regulatory';
          };
          setRegulatoryPosts(
            arr.filter(isRegulatory).sort(sortPinnedThenDateDesc),
          );
          setManualIndustryPosts(
            arr.filter((n) => !isRegulatory(n)).sort(sortPinnedThenDateDesc),
          );
        }
      } catch (e) {
        if (!cancelled) console.error('LatestNewsPage news load failed', e);
      } finally {
        if (!cancelled) setLoadingRegulatory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingIndustry(true);
    (async () => {
      try {
        // curated=1 fans out to India + WHO + Codex + USFDA + Food
        // Safety Magazine. hl=mix returns Hindi + English interleaved.
        const r = await fetch(
          `/api/academy/google-news?curated=1&hl=mix&limit=36`,
        );
        const j = await r.json();
        if (!cancelled) setIndustryNoKeywords(j?.empty === true);
        const raw: Array<{
          id?: string;
          title?: string;
          link?: string;
          source?: string;
          image?: string;
          published_on?: string;
          excerpt?: string;
        }> = Array.isArray(j?.items) ? j.items : [];
        const mapped: NewsPost[] = raw
          .filter((it) => it && typeof it.title === 'string' && typeof it.link === 'string')
          .map((it, idx) => ({
            id: it.id || it.link || `gnews-${idx}`,
            slug: it.id || it.link || `gnews-${idx}`,
            title: it.title!,
            category: it.source || 'Google News',
            excerpt: it.excerpt || '',
            cover_image: it.image || '',
            published_on: it.published_on || '',
            feed_group: 'industry' as const,
            external_url: it.link!,
          }));
        if (!cancelled) setIndustryPosts(mapped);
      } catch (e) {
        if (!cancelled) console.error('LatestNewsPage google-news load failed', e);
      } finally {
        if (!cancelled) setLoadingIndustry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const matchesSearch = (post: NewsPost) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const title = (localizedField(post, lang, 'title') || '').toLowerCase();
    const excerpt = (localizedField(post, lang, 'excerpt') || '').toLowerCase();
    const category = (localizedField(post, lang, 'category') || '').toLowerCase();
    return title.includes(q) || excerpt.includes(q) || category.includes(q);
  };

  const categoryChips = useMemo(() => {
    const seen = new Map<string, string>();
    regulatoryPosts.forEach((p) => {
      const c = (localizedField(p, lang, 'category') || p.category || '').trim();
      if (c) {
        const key = c.toLowerCase();
        if (!seen.has(key)) seen.set(key, c);
      }
    });
    return Array.from(seen.values());
  }, [regulatoryPosts, lang]);

  const filteredRegulatory = useMemo(() => {
    return regulatoryPosts.filter((p) => {
      if (!matchesSearch(p)) return false;
      if (activeChip !== 'all') {
        const c = (localizedField(p, lang, 'category') || p.category || '').toLowerCase();
        if (c !== activeChip.toLowerCase()) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regulatoryPosts, search, activeChip, lang]);

  const filteredIndustry = useMemo(() => {
    // Merge admin-managed "General" posts with the live Google News
    // feed. Pinned manual posts always lead; everything else falls back
    // to published_on desc so a freshly-added manual article shows up
    // alongside Google results immediately.
    const merged = [...manualIndustryPosts, ...industryPosts].sort(
      sortPinnedThenDateDesc,
    );
    return merged.filter((p) => matchesSearch(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualIndustryPosts, industryPosts, search, lang]);

  // Reset the visible window whenever the active filters change so the
  // "Load more" pager always starts at the first page of the new result set.
  // Also cancel any pending load-more timer so a stale increment doesn't
  // land after the reset.
  useEffect(() => {
    if (regulatoryLoadMoreTimer.current) {
      clearTimeout(regulatoryLoadMoreTimer.current);
      regulatoryLoadMoreTimer.current = null;
    }
    setRegulatoryLoadingMore(false);
    setRegulatoryVisible(PAGE_SIZE);
  }, [search, activeChip, regulatoryPosts]);

  useEffect(() => {
    if (industryLoadMoreTimer.current) {
      clearTimeout(industryLoadMoreTimer.current);
      industryLoadMoreTimer.current = null;
    }
    setIndustryLoadingMore(false);
    setIndustryVisible(PAGE_SIZE);
  }, [search, industryPosts, manualIndustryPosts]);

  useEffect(() => {
    return () => {
      if (regulatoryLoadMoreTimer.current) clearTimeout(regulatoryLoadMoreTimer.current);
      if (industryLoadMoreTimer.current) clearTimeout(industryLoadMoreTimer.current);
    };
  }, []);

  const visibleRegulatory = filteredRegulatory.slice(0, regulatoryVisible);
  const visibleIndustry = filteredIndustry.slice(0, industryVisible);
  const hasMoreRegulatory = regulatoryVisible < filteredRegulatory.length;
  const hasMoreIndustry = industryVisible < filteredIndustry.length;

  const loadMoreRegulatory = () => {
    if (regulatoryLoadingMore) return;
    setRegulatoryLoadingMore(true);
    if (regulatoryLoadMoreTimer.current) clearTimeout(regulatoryLoadMoreTimer.current);
    regulatoryLoadMoreTimer.current = setTimeout(() => {
      setRegulatoryVisible((n) => n + PAGE_SIZE);
      setRegulatoryLoadingMore(false);
    }, 250);
  };

  const loadMoreIndustry = () => {
    if (industryLoadingMore) return;
    setIndustryLoadingMore(true);
    if (industryLoadMoreTimer.current) clearTimeout(industryLoadMoreTimer.current);
    industryLoadMoreTimer.current = setTimeout(() => {
      setIndustryVisible((n) => n + PAGE_SIZE);
      setIndustryLoadingMore(false);
    }, 250);
  };

  return (
    <PublicSiteShell activeSection="news" initialPublicOnly={initialPublicOnly}>
      <main className="bg-gradient-to-b from-slate-50 to-white">
        {/* HERO */}
        <section className="border-b border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black uppercase tracking-[0.25em]">
                  <Newspaper className="w-3.5 h-3.5" />
                  {t.newsEyebrow}
                </span>
                <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                  {t.latestNewsHeroTitlePrefix}{' '}
                  <span className="text-emerald-600">{t.latestNewsHeroTitleHighlight}</span>
                </h1>
                <p className="mt-4 text-base sm:text-lg text-slate-500 leading-relaxed max-w-2xl">
                  {t.latestNewsHeroSubtitle}
                </p>
              </div>
              <div className="lg:justify-self-end w-full max-w-md">
                <label className="relative block">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.latestNewsSearchPlaceholder}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors"
                    aria-label={t.latestNewsSearchPlaceholder}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* COURSE RIBBON — RTL infinite-scroll cross-promo for the
            HACCP PRO Academy. Placed right under the hero so it's
            the first thing readers see, maximizing ad reach. */}
        <section className="border-t border-slate-100 pt-8 pb-2 sm:pt-10">
          <CourseRibbon
            eyebrow={t.latestNewsCtaPill}
            ctaLabel={t.latestNewsCtaButton}
          />
        </section>

        {/* REGULATORY & COMPLIANCE UPDATES */}
        <section className="border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <SectionHeader
              icon={<Gavel className="w-5 h-5" />}
              tone="indigo"
              title={t.latestNewsRegulatoryTitle}
              count={filteredRegulatory.length}
              countLabel={t.latestNewsUpdatesCount}
            />

            {categoryChips.length > 0 && (
              <div className="mt-6 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
                <div className="flex items-center gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
                  <Chip
                    active={activeChip === 'all'}
                    onClick={() => setActiveChip('all')}
                    label={t.latestNewsChipAll}
                  />
                  {categoryChips.map((c) => (
                    <Chip
                      key={c}
                      active={activeChip.toLowerCase() === c.toLowerCase()}
                      onClick={() => setActiveChip(c)}
                      label={c}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              {loadingRegulatory ? (
                <CardGridSkeleton />
              ) : filteredRegulatory.length === 0 ? (
                <EmptyInline
                  icon={<Gavel className="w-6 h-6" />}
                  title={t.latestNewsRegulatoryEmptyTitle}
                  body={t.latestNewsEmptyBody}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleRegulatory.map((p) => (
                      <NewsCard
                        key={p.id}
                        post={p}
                        tone="regulatory"
                        lang={lang}
                        locale={locale}
                        newPillLabel={t.newsNewPill}
                        sourceLabel={t.latestNewsOfficialGazette}
                        untitledLabel={t.untitledArticle}
                        featuredLabel={t.latestNewsFeaturedPill}
                        shareLabel={t.latestNewsShare}
                        shareCopiedLabel={t.latestNewsShareCopied}
                        clickCount={clickCounts[p.id] || 0}
                      />
                    ))}
                  </div>
                  <LoadMoreFooter
                    tone="regulatory"
                    visible={visibleRegulatory.length}
                    total={filteredRegulatory.length}
                    hasMore={hasMoreRegulatory}
                    loading={regulatoryLoadingMore}
                    onLoadMore={loadMoreRegulatory}
                    loadMoreLabel={t.latestNewsLoadMore}
                    loadingLabel={t.latestNewsLoadingMore}
                    showingLabel={t.latestNewsShowingCount}
                  />
                </>
              )}
            </div>
          </div>
        </section>

        {/* ENROLMENT CTA */}
        <section className="border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-8 sm:p-12 text-white shadow-2xl shadow-indigo-500/20">
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-violet-300/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-center">
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                    <GraduationCap className="w-3.5 h-3.5" /> {t.latestNewsCtaPill}
                  </span>
                  <h3 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                    {t.latestNewsCtaTitle}
                  </h3>
                  <p className="mt-3 text-indigo-100 text-base max-w-2xl">
                    {t.latestNewsCtaSubtitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-start lg:justify-end">
                  <Link
                    href="/academy"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-indigo-700 font-extrabold text-sm hover:bg-indigo-50 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
                  >
                    {t.latestNewsCtaButton} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INDUSTRY TRENDS & GENERAL NEWS */}
        <section className="border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <SectionHeader
              icon={<BookOpen className="w-5 h-5" />}
              tone="emerald"
              title={t.latestNewsIndustryTitle}
              count={filteredIndustry.length}
              countLabel={t.latestNewsUpdatesCount}
            />

            <div className="mt-8">
              {loadingIndustry ? (
                <CardGridSkeleton />
              ) : filteredIndustry.length === 0 ? (
                <EmptyInline
                  icon={<BookOpen className="w-6 h-6" />}
                  title={
                    industryNoKeywords && industryPosts.length === 0
                      ? t.latestNewsIndustryEmptyNoKeywordsTitle
                      : t.latestNewsIndustryEmptyTitle
                  }
                  body={
                    industryNoKeywords && industryPosts.length === 0
                      ? t.latestNewsIndustryEmptyNoKeywordsBody
                      : t.latestNewsEmptyBody
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleIndustry.map((p) => (
                      <NewsCard
                        key={p.id}
                        post={p}
                        tone="industry"
                        lang={lang}
                        locale={locale}
                        newPillLabel={t.newsNewPill}
                        sourceLabel={t.latestNewsGoogleNews}
                        untitledLabel={t.untitledArticle}
                        shareLabel={t.latestNewsShare}
                        shareCopiedLabel={t.latestNewsShareCopied}
                        clickCount={clickCounts[p.id] || 0}
                      />
                    ))}
                  </div>
                  <LoadMoreFooter
                    tone="industry"
                    visible={visibleIndustry.length}
                    total={filteredIndustry.length}
                    hasMore={hasMoreIndustry}
                    loading={industryLoadingMore}
                    onLoadMore={loadMoreIndustry}
                    loadMoreLabel={t.latestNewsLoadMore}
                    loadingLabel={t.latestNewsLoadingMore}
                    showingLabel={t.latestNewsShowingCount}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <FloatingCourses />
    </PublicSiteShell>
  );
}

function SectionHeader({
  icon,
  tone,
  title,
  count,
  countLabel,
}: {
  icon: ReactNode;
  tone: 'indigo' | 'emerald';
  title: string;
  count: number;
  countLabel: (n: number) => string;
}) {
  const iconBg =
    tone === 'indigo'
      ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
      : 'bg-emerald-50 text-emerald-600 border-emerald-100';
  const counterBg =
    tone === 'indigo'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
      : 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl border ${iconBg}`}
        >
          {icon}
        </span>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          {title}
        </h2>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-[0.18em] ${counterBg}`}
      >
        {countLabel(count)}
      </span>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-extrabold uppercase tracking-widest border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
        active
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse"
        >
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="mt-3 h-5 w-5/6 bg-slate-200 rounded" />
          <div className="mt-2 h-4 w-full bg-slate-100 rounded" />
          <div className="mt-2 h-4 w-2/3 bg-slate-100 rounded" />
          <div className="mt-6 flex items-center justify-between">
            <div className="h-3 w-24 bg-slate-100 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadMoreFooter({
  tone,
  visible,
  total,
  hasMore,
  loading,
  onLoadMore,
  loadMoreLabel,
  loadingLabel,
  showingLabel,
}: {
  tone: 'regulatory' | 'industry';
  visible: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  loadMoreLabel: string;
  loadingLabel: string;
  showingLabel: (shown: number, total: number) => string;
}) {
  // Reserve a fixed-height row so toggling the spinner / button doesn't
  // shift the cards above as the user pages through results.
  if (total <= visible && !hasMore && total <= PAGE_SIZE) {
    return null;
  }

  const buttonTone =
    tone === 'regulatory'
      ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-300 text-white'
      : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300 text-white';

  return (
    <div className="mt-10 min-h-[72px] flex flex-col items-center justify-center gap-2">
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          aria-busy={loading}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-extrabold uppercase tracking-widest shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed ${buttonTone}`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {loadingLabel}
            </>
          ) : (
            <>
              {loadMoreLabel}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      ) : null}
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {showingLabel(Math.min(visible, total), total)}
      </span>
    </div>
  );
}

function EmptyInline({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-md mx-auto text-center bg-white border border-dashed border-slate-200 rounded-2xl py-12 px-6">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200">
        {icon}
      </div>
      <p className="mt-4 text-sm font-extrabold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

function NewsCard({
  post,
  tone,
  lang,
  locale,
  newPillLabel,
  sourceLabel,
  untitledLabel,
  featuredLabel,
  shareLabel,
  shareCopiedLabel,
  clickCount = 0,
}: {
  post: NewsPost;
  tone: 'regulatory' | 'industry';
  lang: LandingLang;
  locale: string;
  newPillLabel: string;
  sourceLabel: string;
  untitledLabel: string;
  featuredLabel?: string;
  shareLabel: string;
  shareCopiedLabel: string;
  clickCount?: number;
}) {
  // Show an optimistic +1 the moment the reader clicks so the
  // counter feels reactive even before the backend GET catches up.
  const [optimisticBump, setOptimisticBump] = useState(0);
  const displayedClicks = clickCount + optimisticBump;
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const sharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );
  const slug = post.slug || post.id;
  const title = localizedField(post, lang, 'title') || untitledLabel;
  const rawExcerpt = localizedField(post, lang, 'excerpt');
  const category = localizedField(post, lang, 'category');
  // Industry feed items occasionally come back from Google News without
  // a usable <description> blob. Falling back to the source/category
  // keeps every card visually balanced (and tells the reader where the
  // story is from) instead of leaving an empty gap above the date row.
  const excerpt =
    rawExcerpt ||
    (tone === 'industry' && category
      ? `${sourceLabel} · ${category}`
      : '');
  const isNew = isWithinDays(post.published_on, 14);
  const isFeatured = !!post.pinned && tone === 'regulatory' && !!featuredLabel;
  // Regulatory posts open the internal reader (/news/[slug]) by default,
  // but admins can override that by setting an `external_url` on the
  // post — in that case we open the external source in a new tab so
  // the official gazette / regulator page is one click away.
  // Industry rows always go out to either the admin-pinned external
  // URL or a Google News search for the headline.
  const hasExternal = !!post.external_url && /^https?:\/\//i.test(post.external_url);
  const externalHref =
    tone === 'industry'
      ? hasExternal
        ? post.external_url!
        : `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=${
            lang === 'hi' ? 'hi-IN' : 'en-US'
          }`
      : hasExternal
        ? post.external_url!
        : null;
  const isExternal = !!externalHref;

  const pillTone =
    tone === 'regulatory'
      ? 'bg-indigo-50 text-indigo-700'
      : 'bg-emerald-50 text-emerald-700';
  const linkTone =
    tone === 'regulatory'
      ? 'text-indigo-600 group-hover:text-indigo-700'
      : 'text-emerald-600 group-hover:text-emerald-700';
  const hoverBorder =
    tone === 'regulatory' ? 'hover:border-indigo-300' : 'hover:border-emerald-300';

  const handleClick = () => {
    setOptimisticBump((n) => n + 1);
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
      /* never block navigation */
    }
  };

  const formatCount = (n: number): string => {
    if (n < 1000) return String(n);
    if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
    if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1_000_000).toFixed(1)}M`;
  };

  // Mint (or look up) the short share URL for this article. Used by
  // both the native-share button and the dedicated copy-link button
  // so they always emit the same branded haccp.pro/n/<token> URL.
  const buildShareUrl = async (): Promise<string> => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://haccp.pro';
    const destLink = post.external_url || `${origin}/news/${encodeURIComponent(slug)}`;
    let shareUrl = `${origin}/news#article-${encodeURIComponent(post.id)}`;
    try {
      const r = await fetch('/api/news/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link: destLink,
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
      /* fall through with deep-link fallback */
    }
    return shareUrl;
  };

  // Share routes everyone through OUR short URL (haccp.pro/n/<token>),
  // which is (a) compact enough to paste anywhere and (b) renders a
  // proper Open Graph card with the article title + publisher logo
  // so WhatsApp / Twitter / LinkedIn / iMessage all show a thumbnail
  // preview. The /n/<token> page then redirects to the publisher,
  // keeping the audience funnel intact.
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = await buildShareUrl();
    const shareData = { title, text: title, url: shareUrl };
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData);
      } else if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(shareUrl);
        setShared(true);
        if (sharedTimer.current) clearTimeout(sharedTimer.current);
        sharedTimer.current = setTimeout(() => setShared(false), 2000);
      } else {
        window.prompt(shareLabel, shareUrl);
      }
    } catch {
      /* user cancelled / share unavailable — silent */
    }
  };

  // Dedicated copy-link button — bypasses the native share sheet
  // entirely and just drops the branded short URL on the clipboard.
  // Useful on desktop where navigator.share isn't available, and on
  // mobile when the user just wants the URL without picking an app.
  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = await buildShareUrl();
    let ok = false;
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      }
    } catch {
      /* fall through to legacy path */
    }
    if (!ok && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt(shareLabel, shareUrl);
    }
  };

  const coverImage = post.cover_image && post.cover_image.trim() ? post.cover_image : '';

  const inner = (
    <>
      {coverImage && (() => {
        // Favicons (Google s2 service) are tiny logos. In production
        // the upstream hero-image scrape gets HTTP 503'd by Google,
        // so a large fraction of cards fall back to the favicon. We
        // make those cards look intentional by upgrading to a
        // higher-resolution favicon (sz=512) and pairing it with the
        // publisher name on a branded gradient. Real publisher hero
        // images still fill the card edge-to-edge with object-cover.
        const isFavicon = /\/s2\/favicons\b/i.test(coverImage);
        const faviconHiRes = isFavicon
          ? coverImage.replace(/([?&]sz=)\d+/i, '$1512')
          : coverImage;
        const sourceName = (category || '').trim();
        return (
          <div
            className={`-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-4 h-40 rounded-t-2xl overflow-hidden relative flex items-center justify-center ${
              tone === 'regulatory'
                ? 'bg-gradient-to-br from-indigo-50 via-white to-violet-100'
                : 'bg-gradient-to-br from-emerald-50 via-white to-teal-100'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isFavicon ? faviconHiRes : coverImage}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className={
                isFavicon
                  ? 'max-h-24 max-w-[55%] object-contain drop-shadow-sm'
                  : 'w-full h-full object-cover'
              }
              onError={(ev) => {
                const el = ev.currentTarget as HTMLImageElement;
                // Step down sz=512 → original favicon → hide.
                if (isFavicon && el.src !== coverImage) {
                  el.src = coverImage;
                } else {
                  el.style.display = 'none';
                }
              }}
            />
            {isFavicon && sourceName && (
              <span
                className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/85 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest shadow-sm ${
                  tone === 'regulatory' ? 'text-indigo-700' : 'text-emerald-700'
                }`}
              >
                {sourceName}
              </span>
            )}
          </div>
        );
      })()}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isFeatured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">
              <Pin className="w-3 h-3 fill-current" />
              {featuredLabel}
            </span>
          )}
          {category ? (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${pillTone}`}
            >
              {category}
            </span>
          ) : null}
        </div>
        {isNew && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
            {newPillLabel}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-extrabold text-slate-900 text-lg leading-snug line-clamp-3">
        {title}
      </h3>
      {excerpt && (
        <p className="mt-3 text-sm text-slate-500 leading-relaxed line-clamp-3">
          {excerpt}
        </p>
      )}
      <div className="mt-auto pt-5 flex items-center justify-between gap-3 text-[12px] font-bold">
        <span className="inline-flex items-center gap-3 text-slate-500 min-w-0">
          <span className="inline-flex items-center gap-1.5 truncate">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{formatLongDate(post.published_on, locale)}</span>
          </span>
          {displayedClicks > 0 && (
            <span
              className="inline-flex items-center gap-1 text-slate-400"
              title={`${displayedClicks.toLocaleString()} reader${
                displayedClicks === 1 ? '' : 's'
              } opened this article`}
            >
              <Eye className="w-3.5 h-3.5" />
              {formatCount(displayedClicks)}
            </span>
          )}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest ${linkTone} shrink-0`}
        >
          {sourceLabel}{' '}
          {isExternal ? (
            <ExternalLink className="w-3.5 h-3.5" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
        </span>
      </div>
    </>
  );

  const featuredAccent = isFeatured
    ? 'border-indigo-300 ring-1 ring-indigo-200/70 shadow-md shadow-indigo-100/60'
    : 'border-slate-200';
  const cls = `group bg-white rounded-2xl border ${featuredAccent} ${hoverBorder} hover:shadow-xl transition-all duration-200 p-5 sm:p-6 flex flex-col h-full focus:outline-none focus:ring-2 focus:ring-offset-2 overflow-hidden ${
    tone === 'regulatory' ? 'focus:ring-indigo-300' : 'focus:ring-emerald-300'
  }`;

  // Share + Copy buttons rendered as a sibling overlay (not nested
  // inside the <a>/<Link>) so they stay HTML-valid and can
  // stopPropagation without interfering with the card's primary
  // click target. Copy sits to the LEFT of Share so the share icon
  // stays in its original top-right position from earlier designs.
  const shareButton = (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleCopyLink}
        aria-label={copied ? shareCopiedLabel : 'Copy link'}
        title={copied ? shareCopiedLabel : 'Copy link'}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-md transition-all"
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-600" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
      <button
        type="button"
        onClick={handleShare}
        aria-label={shareLabel}
        title={shared ? shareCopiedLabel : shareLabel}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-md transition-all"
      >
        {shared ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
      </button>
    </div>
  );

  if (externalHref) {
    // EVERY external-link card — admin "External link" posts AND
    // auto-Google-News rows in both Regulatory and General feeds —
    // gets routed through our /n/<token> share landing so the
    // visitor sees the training-ad interstitial before being
    // redirected to the publisher. Same funnel as the share /
    // copy-link buttons, so a click and a shared URL behave
    // identically.
    const isLinkMode = hasExternal;
    const handleAdvertisedClick = (e: React.MouseEvent) => {
      e.preventDefault();
      handleClick();
      // Open the new tab SYNCHRONOUSLY inside the click handler so
      // popup blockers don't kill it — buildShareUrl() is async and
      // any window.open() after the await loses the user-gesture
      // permission in Chrome/Safari. We point the placeholder tab at
      // the eventual external URL up front so a network failure in
      // the share-mint step still lands the visitor on the article.
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
      <div className="relative h-full">
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={isLinkMode ? handleAdvertisedClick : handleClick}
          className={cls}
        >
          {inner}
        </a>
        {shareButton}
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <Link href={`/news/${encodeURIComponent(slug)}`} onClick={handleClick} className={cls}>
        {inner}
      </Link>
      {shareButton}
    </div>
  );
}
