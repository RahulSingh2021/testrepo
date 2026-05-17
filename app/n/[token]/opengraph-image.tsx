import { ImageResponse } from 'next/og';
import sql from '@/lib/db';

// Dynamic Open Graph image for shared news links. Generates a
// 1200x630 banner so WhatsApp, Telegram, LinkedIn, Twitter etc.
// always render the link as a LARGE top-banner card — even when
// the publisher's own og:image is just a small square logo
// (which was triggering WhatsApp's tiny side-thumbnail layout
// for Times-of-India / Google-News headlines).
//
// Layout mirrors the in-app news card: source pill on top, headline
// in big bold type, "HACCP PRO · Food Safety News" footer with a
// thumbnail of the publisher logo on the right when available.
//
// Next.js automatically picks this file up as the `og:image` for
// every `/n/<token>` URL, overriding any `images` we set in
// generateMetadata.

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'HACCP PRO · Food Safety News';

interface Row {
  title: string | null;
  image: string | null;
  source: string | null;
}

const lookup = async (token: string): Promise<Row | null> => {
  if (!token || token.length > 32) return null;
  try {
    const rows = await sql`SELECT title, image, source
                            FROM news_shares
                            WHERE token = ${token}
                            LIMIT 1`;
    if (Array.isArray(rows) && rows[0]) return rows[0] as Row;
  } catch {
    /* fall through to default card */
  }
  return null;
};

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

export default async function Image({
  params,
}: {
  params: { token: string };
}) {
  const row = await lookup(params.token);
  const title = truncate(row?.title || 'Food Safety News', 180);
  const source = truncate(row?.source || 'Industry update', 60);
  const logo = row?.image || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #ecfdf5 0%, #ffffff 55%, #eef2ff 100%)',
          padding: 64,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 22px',
              background: 'rgba(16, 185, 129, 0.12)',
              borderRadius: 999,
              border: '2px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: '#10b981',
              }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#047857',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              {source}
            </span>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#4f46e5',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            HACCP PRO
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 56,
            marginTop: 40,
          }}
        >
          {logo ? (
            <div
              style={{
                width: 220,
                height: 220,
                flexShrink: 0,
                borderRadius: 32,
                background: '#ffffff',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: 18,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt=""
                width={184}
                height={184}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                color: '#0f172a',
                lineHeight: 1.12,
                letterSpacing: '-0.01em',
                display: 'block',
              }}
            >
              {title}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 28,
            borderTop: '2px solid rgba(15, 23, 42, 0.08)',
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#475569',
            }}
          >
            Food Safety News · haccppro.in
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#10b981',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Tap to read →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
