import type { Metadata } from 'next';
import TipReaderPage from '@/components/TipReaderPage';
import { getBaseUrl, getRequestBaseUrl, toAbsoluteUrl } from '@/lib/absoluteUrl';
import { normalizeImageUrl } from '@/lib/normalizeImageUrl';
import { getServerIsPublicOnly } from '@/lib/serverIsPublicOnly';

// Public reader page for a single Daily Food-Safety Tip. The slug is
// resolved against /api/academy/safety-tips?slug=... (which only
// returns published rows). Mirrors the /news/<slug> route — same
// editorial UX, same Open Graph / Twitter metadata so a shared link
// renders a rich preview card on WhatsApp / LinkedIn / Twitter etc.

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

async function fetchTip(slug: string, baseUrl: string) {
  try {
    const r = await fetch(`${baseUrl}/api/academy/safety-tips?slug=${encodeURIComponent(slug)}`, {
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
  // Fetch against env-pinned base; canonicalise against request host
  // so the mirror domain canonicalises to itself. See news/[slug].
  const fetchBase = await getBaseUrl();
  const requestBase = await getRequestBaseUrl();
  const tip = await fetchTip(slug, fetchBase);
  const url = `${requestBase}/tips/${encodeURIComponent(slug)}`;

  if (!tip) {
    return {
      title: 'Daily Food-Safety Tip | HACCP PRO',
      description:
        'Bite-sized food-safety tips your kitchen team can apply on shift, from HACCP PRO.',
      alternates: { canonical: url },
    };
  }

  const title = tip.title || 'Daily Food-Safety Tip';
  const description = tip.excerpt || stripHtml(tip.body) ||
    'Bite-sized food-safety tips your kitchen team can apply on shift, from HACCP PRO.';
  // Prefer the dedicated share thumbnail (a small, hook-style image
  // editors upload separately for social-media previews). Fall back to
  // the in-page cover image when no share thumbnail has been set, so
  // existing tips keep their current preview behaviour.
  const shareSrc = (tip.share_image && String(tip.share_image).trim()) || tip.cover_image;
  const cover = toAbsoluteUrl(normalizeImageUrl(shareSrc), requestBase);
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
      publishedTime: tip.published_on || undefined,
      authors: tip.author ? [tip.author] : undefined,
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function TipRoute({ params }: PageProps) {
  const { slug } = await params;
  const requestBase = await getRequestBaseUrl();
  const shareUrl = `${requestBase}/tips/${encodeURIComponent(slug)}`;
  const initialPublicOnly = await getServerIsPublicOnly();
  return <TipReaderPage slug={slug} shareUrl={shareUrl} initialPublicOnly={initialPublicOnly} />;
}
