import { NextResponse, type NextRequest } from 'next/server';
import { isPublicOnlyHost, PUBLIC_ONLY_HEADER, PUBLIC_ONLY_COOKIE } from '@/lib/publicOnlyHosts';

// Allowlist of paths that ARE reachable on a public-only mirror
// domain. Everything else returns a friendly 404. We use an allowlist
// (not a denylist) because the main app has dozens of authenticated
// API routes and surfaces; a denylist would be brittle and error-prone
// when new routes are added. The mirror exists only to host the
// public marketing/landing experience, so the allowlist covers:
//   - the long-scroll landing page and its public sub-pages
//   - the public read-only APIs the landing components fetch
//   - public legal pages
const ALLOWED_PAGE_PREFIXES_ON_PUBLIC = [
  '/',                // exact match handled separately
  '/academy',
  '/courses',
  '/news',
  '/tips',
  '/jobs',
  '/legal',
];

const ALLOWED_API_PREFIXES_ON_PUBLIC = [
  '/api/academy/courses',
  '/api/academy/lessons',
  '/api/academy/safety-tips',
  '/api/academy/news-posts',
  '/api/academy/news-clicks',
  '/api/academy/google-news',
  '/api/training-calendar',
  '/api/app-settings',
  '/api/jobs',
  '/api/news/share',
  '/api/landing-content',
];

function isAllowedOnPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  // Next.js framework / build assets — must always pass through.
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/sw.js'
  ) {
    return true;
  }
  if (pathname.startsWith('/api/')) {
    return ALLOWED_API_PREFIXES_ON_PUBLIC.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`),
    );
  }
  return ALLOWED_PAGE_PREFIXES_ON_PUBLIC.some(
    (p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)),
  );
}

function blockedResponse(): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Not available</title>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<style>html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a}` +
      `.wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}` +
      `h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#475569;font-size:14px;max-width:420px}</style></head>` +
      `<body><div class="wrap"><div><h1>Not available on this site</h1>` +
      `<p>This page lives on the main HACCP&nbsp;PRO application.</p></div></div></body></html>`,
    {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  );
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host');
  const isPublicOnly = isPublicOnlyHost(host);

  if (!isPublicOnly) {
    // Primary domain — defensively strip any forged x-haccp-public-only
    // header so a hostile client can't trick the page into rendering
    // landing-only mode just for themselves. (No security boundary is
    // crossed, but it's confusing UX.) Also clear the cookie if a
    // stray one is present.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.delete(PUBLIC_ONLY_HEADER);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (req.cookies.get(PUBLIC_ONLY_COOKIE)) {
      res.cookies.set(PUBLIC_ONLY_COOKIE, '', { path: '/', maxAge: 0 });
    }
    return res;
  }

  const { pathname } = req.nextUrl;

  // Allowlist: anything not on the small set of public marketing
  // routes / read-only APIs is denied with a friendly 404. This is
  // intentionally stricter than a denylist — the mirror should only
  // ever serve the same content a signed-out visitor sees on the
  // primary domain.
  if (!isAllowedOnPublic(pathname)) {
    return blockedResponse();
  }

  // Forward a header into the request so server components can render
  // landing-only mode without touching cookies, and set a cookie so
  // client-side navigation can read the same flag without an extra
  // round-trip.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PUBLIC_ONLY_HEADER, '1');
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.cookies.set(PUBLIC_ONLY_COOKIE, '1', {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // client reads it for SPA hydration
    maxAge: 60 * 60 * 24, // refreshed on every request anyway
  });
  return res;
}

// Run on every request EXCEPT static assets and Next internals — those
// don't need classification and bypassing them keeps the edge cheap.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|logo|apple-touch-icon|manifest\\.json|robots\\.txt|sitemap\\.xml|sw\\.js|samples/|data/).*)',
  ],
};
