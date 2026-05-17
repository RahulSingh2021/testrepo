import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import sql from '@/lib/db';
import SharePageAdvert from './SharePageAdvert';
import ShareActions from './ShareActions';

// Public landing page for short share URLs (haccp.pro/n/<token>).
// Renders proper Open Graph + Twitter card metadata so WhatsApp,
// Twitter, LinkedIn, etc. show a thumbnail preview, then auto-
// redirects readers to the original publisher article via a small
// client component. The detour is the audience funnel: every shared
// click lands on us first, so we count the visit and brand the
// experience before handing off to the source.
//
// NOTE: app/layout.tsx already supplies <html> and <body>. Per the
// Next.js App Router contract, nested pages must NOT re-render
// those tags or hydration breaks. So this page renders a plain
// container.

export const dynamic = 'force-dynamic';

interface ShareRow {
  token: string;
  link: string;
  title: string | null;
  image: string | null;
  source: string | null;
}

const lookup = async (token: string): Promise<ShareRow | null> => {
  if (!token || token.length > 32) return null;
  try {
    const rows = await sql`SELECT token, link, title, image, source
                            FROM news_shares
                            WHERE token = ${token}
                            LIMIT 1`;
    if (Array.isArray(rows) && rows[0]) return rows[0] as ShareRow;
  } catch (e) {
    console.error('news_shares lookup failed:', e);
  }
  return null;
};

// Re-serialize through the WHATWG URL parser so anything that didn't
// belong in a URL (quotes, angle brackets, control chars) is either
// rejected or percent-encoded. Belt-and-braces against any clever
// payload sneaking past the POST-side validator.
const safeUrl = (raw: string): string => {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const row = await lookup(token);
  const title = row?.title || 'Food Safety News — HACCP PRO';
  const description = row?.source
    ? `${row.source} via HACCP PRO Food Safety News`
    : 'Curated food safety updates from HACCP PRO.';
  // The OG image is generated dynamically by the sibling
  // `opengraph-image.tsx` route so we no longer pass the publisher's
  // raw image (which is often a tiny square logo that WhatsApp
  // renders as the small side-thumbnail layout). Next.js auto-injects
  // the generated 1200x630 banner — branded with the source name and
  // headline — for both Open Graph and Twitter, giving us the rich
  // top-banner card the user asked for on every platform.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'HACCP PRO',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function NewsSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await lookup(token);
  if (!row) notFound();

  const dest = safeUrl(row.link);
  if (!dest) notFound();
  const title = row.title || 'Food Safety News';
  const source = row.source || '';
  const image = row.image || '';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        gap: 28,
        background: 'linear-gradient(135deg, #eef2ff 0%, #ecfdf5 100%)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Top banner thumbnail — full-width, above the headline.
            User specifically asked for the thumbnail on top (not on
            the side) so this matches the WhatsApp large-card layout
            we're requesting via og:image dimensions above. The
            aspect-ratio box keeps the layout stable while the image
            loads, and `objectFit: cover` ensures we get a clean
            edge-to-edge banner regardless of source aspect ratio. */}
        {image ? (
          <div
            style={{
              width: '100%',
              aspectRatio: '1200 / 630',
              background: '#f1f5f9',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
              }}
            />
          </div>
        ) : null}
        <div style={{ padding: '24px 28px 28px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: '#4f46e5',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            HACCP PRO · Food Safety News
          </div>
          <h1
            style={{
              fontSize: 20,
              lineHeight: 1.3,
              color: '#0f172a',
              margin: '4px 0 6px',
              fontWeight: 800,
            }}
          >
            {title}
          </h1>
          {source ? (
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
              {source}
            </div>
          ) : null}
          <p style={{ fontSize: 14, color: '#475569', margin: '0 0 18px' }}>
            Redirecting you to the article…
          </p>
          <ShareActions dest={dest} />
          <div style={{ marginTop: 22, fontSize: 12, color: '#94a3b8' }}>
            Or visit{' '}
            <a
              href="/news"
              style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}
            >
              haccp.pro/news
            </a>{' '}
            for more updates.
          </div>
        </div>
      </div>

      {/* Training-courses advertisement: the FloatingCourses popup
          auto-opens with the full priced course list. The visitor
          sees the offer, then either clicks a course (navigates
          to /courses/...) or dismisses — at which point we
          redirect them to the original article. A 5s safety
          timer handles passive readers. */}
      <SharePageAdvert dest={dest} maxWaitMs={5000} />
    </main>
  );
}
