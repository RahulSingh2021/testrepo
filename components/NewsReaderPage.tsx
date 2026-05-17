'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock, Loader2, Tag } from 'lucide-react';
import { sanitizeNewsHtml } from '@/lib/sanitizeNewsHtml';
import { normalizeImageUrl } from '@/lib/normalizeImageUrl';
import {
  type LandingLang,
  localizedField,
  useLandingT,
} from '@/lib/landingI18n';
import ShareButton from './ShareButton';
import PublicSiteShell from './PublicSiteShell';

// Minimal news article reader. Renders a published academy_news_posts
// row resolved by slug. Body content is HTML pasted from the admin
// Content sub-tab — writes are admin-gated and sanitised on save by
// /api/academy/news-posts, but we sanitise again on render with the
// same allowlist so a compromised admin account or a row that pre-
// dates server-side sanitisation can't ship script/iframe payloads
// to public visitors.

interface NewsPost {
  id: string;
  slug?: string;
  title?: string;
  category?: string;
  excerpt?: string;
  body?: string;
  cover_image?: string;
  published_on?: string;
  read_minutes?: number;
  status?: string;
  author?: string;
  translations?: Partial<Record<LandingLang, Record<string, unknown>>> | null;
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

export default function NewsReaderPage({ slug, shareUrl, initialPublicOnly = false }: { slug: string; shareUrl?: string; initialPublicOnly?: boolean }) {
  const { t, lang, locale } = useLandingT();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Localised text falls back to English when the Hindi variant is
  // missing — keeps unilingual posts working unchanged.
  const localisedTitle = localizedField(post, lang, 'title');
  const localisedExcerpt = localizedField(post, lang, 'excerpt');
  const localisedCategory = localizedField(post, lang, 'category');
  const localisedBody = localizedField(post, lang, 'body');

  // Use the shared news sanitiser (now extracted into @/lib/sanitizeNewsHtml
  // by the main app) on the localised body so the Hindi variant gets the
  // same allow-list as the English one.
  const safeBody = useMemo(() => sanitizeNewsHtml(localisedBody || ''), [localisedBody]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/academy/news-posts?slug=${encodeURIComponent(slug)}`);
        const j = await r.json();
        if (cancelled) return;
        if (!j?.item) {
          setNotFound(true);
        } else {
          setPost(j.item);
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

  return (
    <PublicSiteShell activeSection="news" initialPublicOnly={initialPublicOnly}>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 bg-gradient-to-b from-slate-50 to-white">
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t.newsBackToNews}
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.newsLoading}
          </div>
        ) : notFound || !post ? (
          <div className="py-32 text-center">
            <p className="text-lg font-extrabold text-slate-900">
              {t.newsNotFoundTitle}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t.newsNotFoundBody}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800"
            >
              {t.newsReturnHome}
            </Link>
          </div>
        ) : (
          <article className="mt-6">
            {localisedCategory && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
                <Tag className="w-3 h-3" /> {localisedCategory}
              </span>
            )}
            <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
              {localisedTitle || t.untitledArticle}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] font-bold text-slate-500">
              {post.published_on && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> {formatDate(post.published_on, locale)}
                </span>
              )}
              {post.read_minutes ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {post.read_minutes} {t.cardMinRead}
                </span>
              ) : null}
              {post.author && (
                <span className="inline-flex items-center gap-1.5">
                  {t.newsBy} <span className="text-indigo-600">{post.author}</span>
                </span>
              )}
            </div>
            {post.cover_image && (
              /* Flexible image container: shows the WHOLE picture
                 regardless of aspect ratio (was 16:9 + object-cover
                 which cropped tall portraits to the point of looking
                 blank). max-h keeps very tall images from dominating
                 the article. */
              <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center max-h-[600px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizeImageUrl(post.cover_image)}
                  alt={localisedTitle || t.newsCoverAlt}
                  className="w-full h-auto max-h-[600px] object-contain"
                />
              </div>
            )}
            {localisedExcerpt && (
              <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed font-medium">
                {localisedExcerpt}
              </p>
            )}
            {safeBody && (
              <div
                className="prose prose-slate max-w-none mt-6 text-[15px] leading-relaxed text-slate-800 [&_p]:my-4 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-extrabold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-indigo-600 [&_a]:underline [&_img]:rounded-xl [&_img]:my-4"
                dangerouslySetInnerHTML={{ __html: safeBody }}
              />
            )}
            <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <Link
                href="/news"
                className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-500 hover:text-indigo-600"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {t.newsBackToNews}
              </Link>
              <ShareButton
                url={shareUrl || (typeof window !== 'undefined' ? window.location.href : '')}
                title={localisedTitle || t.untitledArticle}
                text={localisedExcerpt || ''}
                label={t.shareLabel}
                copiedLabel={t.shareCopied}
              />
            </div>
          </article>
        )}
      </main>
    </PublicSiteShell>
  );
}
