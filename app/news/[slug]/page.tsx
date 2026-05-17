import type { Metadata } from 'next';
import NewsReaderPage from '@/components/NewsReaderPage';
import { getBaseUrl, getRequestBaseUrl, toAbsoluteUrl } from '@/lib/absoluteUrl';
import { normalizeImageUrl } from '@/lib/normalizeImageUrl';
import { getServerIsPublicOnly } from '@/lib/serverIsPublicOnly';

// Public reader page for a single Food Safety News post. The slug is
// resolved by NewsReaderPage against /api/academy/news-posts?slug=...
// (which only returns published rows). No login required.
//
// We also fetch the post server-side in generateMetadata so social
// shares (WhatsApp, LinkedIn, Twitter, Facebook, Slack…) get a rich
// preview card with the article title, excerpt and cover image
// instead of the generic site title.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
};

async function fetchPost(slug: string, baseUrl: string) {
  try {
    const r = await fetch(`${baseUrl}/api/academy/news-posts?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.item || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // Fetch the post against an env-pinned base URL (works during build
  // and on every host), but emit canonical / og:url against the
  // ACTUAL request host so the public-only mirror canonicalises to
  // itself instead of always to the primary domain.
  const fetchBase = await getBaseUrl();
  const requestBase = await getRequestBaseUrl();
  const post = await fetchPost(slug, fetchBase);
  const url = `${requestBase}/news/${encodeURIComponent(slug)}`;

  if (!post) {
    return {
      title: 'Food Safety News | HACCP PRO',
      description:
        'Latest food-safety news, regulatory updates and industry analysis from HACCP PRO.',
      alternates: { canonical: url },
    };
  }

  const title = post.title || 'Food Safety News';
  const description = post.excerpt || stripHtml(post.body) ||
    'Latest food-safety news, regulatory updates and industry analysis from HACCP PRO.';
  const cover = toAbsoluteUrl(normalizeImageUrl(post.cover_image), requestBase);
  const images = cover ? [{ url: cover, alt: title }] : undefined;

  return {
    title: `${title} | HACCP PRO`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'HACCP PRO',
      images,
      publishedTime: post.published_on || undefined,
      authors: post.author ? [post.author] : undefined,
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function NewsRoute({ params }: PageProps) {
  const { slug } = await params;
  const requestBase = await getRequestBaseUrl();
  const shareUrl = `${requestBase}/news/${encodeURIComponent(slug)}`;
  const initialPublicOnly = await getServerIsPublicOnly();
  return <NewsReaderPage slug={slug} shareUrl={shareUrl} initialPublicOnly={initialPublicOnly} />;
}
