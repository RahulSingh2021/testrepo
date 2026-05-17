import { NextRequest, NextResponse } from 'next/server';
import { recordMarketingEvent } from '@/lib/marketingEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1×1 transparent GIF — bytes are hard-coded so we never depend on a file
// on disk and the response is identical for every recipient.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Content-Length': String(PIXEL.length),
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

// GET /api/marketing-track/open?c=<campaignId>&r=<recipientId>
// Logs an `open` event for (campaign, recipient) and always returns the
// 1×1 GIF so the recipient's mail client never shows a broken image.
// Honours the DNT (Do-Not-Track) request header — if set we skip the
// database write but still return the pixel so the email render is
// indistinguishable to the user.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const campaignId = (url.searchParams.get('c') || '').trim();
  const recipientId = (url.searchParams.get('r') || '').trim();
  const dnt = request.headers.get('dnt') === '1';

  if (campaignId && recipientId && !dnt) {
    try {
      await recordMarketingEvent({
        campaignId,
        recipientId,
        event: 'open',
        userAgent: request.headers.get('user-agent') || null,
      });
    } catch (err) {
      // Never let a logging failure break the pixel render — that would
      // surface a broken image to the recipient. Surface to server logs
      // so an operator can diagnose without affecting deliverability.
      console.error('marketing-track/open record failed:', err);
    }
  }

  return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
}
