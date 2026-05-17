import { NextRequest, NextResponse } from 'next/server';
import { recordMarketingEvent } from '@/lib/marketingEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/marketing-track/click?c=<campaignId>&r=<recipientId>&u=<encoded-url>
// Logs a `click` event and 302-redirects the recipient to the original URL.
// We only redirect to absolute http(s) URLs to avoid being abused as an
// open redirector for arbitrary schemes (javascript:, data:, etc.).
// Honours the DNT header by skipping the DB write but still redirecting.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const campaignId = (url.searchParams.get('c') || '').trim();
  const recipientId = (url.searchParams.get('r') || '').trim();
  const target = (url.searchParams.get('u') || '').trim();
  const dnt = request.headers.get('dnt') === '1';

  if (!target || !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: 'Missing or invalid target URL.' }, { status: 400 });
  }

  if (campaignId && recipientId && !dnt) {
    try {
      await recordMarketingEvent({
        campaignId,
        recipientId,
        event: 'click',
        url: target.slice(0, 2000),
        userAgent: request.headers.get('user-agent') || null,
      });
    } catch (err) {
      // Logging failure must NOT block the redirect — the user already
      // clicked and expects to land on the page they were promised.
      console.error('marketing-track/click record failed:', err);
    }
  }

  return NextResponse.redirect(target, 302);
}
