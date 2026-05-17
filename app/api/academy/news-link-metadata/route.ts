import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { isSafeUrl, resolveArticleMetadata } from '@/lib/newsThumbnail';

// POST { url } → { title, excerpt, image, publisher, finalUrl }
//
// Backs the "Quick add link" admin flow on the Food Safety News panel.
// The editor pastes any article URL (including a Google News redirect)
// and we pre-fill the headline + excerpt + thumbnail from the publisher
// page so they only have to click Save. Admin-gated because the resolver
// makes outbound HTTP requests on behalf of the server.

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const RESOLVE_TIMEOUT_MS = 8000;

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requireAdminSession(request);
    if (unauthorized) return unauthorized;

    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }
    if (!isSafeUrl(url)) {
      return NextResponse.json({ error: 'URL is not reachable from a safe public host.' }, { status: 400 });
    }

    const meta = await resolveArticleMetadata(url, RESOLVE_TIMEOUT_MS);
    return NextResponse.json({
      title: meta.title || '',
      excerpt: meta.description || '',
      image: meta.image || '',
      publisher: meta.publisher || '',
      finalUrl: meta.finalUrl || url,
    });
  } catch (error) {
    console.error('news-link-metadata POST error:', error);
    return NextResponse.json({ error: 'Could not read that page.' }, { status: 500 });
  }
}
