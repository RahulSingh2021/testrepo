import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Per-blast click tracker for "Send WhatsApp Blast" links.
//
// Recipients click https://<host>/r/<token> in their WhatsApp message.
// We:
//   1. Look up the blast row by token to find the original
//      registration URL the admin actually wanted them to land on.
//   2. Best-effort log a click row (ip + user-agent + referer).
//   3. 302-redirect to the registration URL.
//
// All steps are best-effort. If anything fails we still redirect — to
// the registration URL when we have it, otherwise to "/" so the user
// is never stranded on an error page.

const FALLBACK = '/';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const safeToken = String(token || '').slice(0, 32);
  let target = FALLBACK;

  if (safeToken) {
    try {
      const rows: any = await sql`
        SELECT data->>'registrationUrl' AS url
        FROM whatsapp_multi_training_promos
        WHERE token = ${safeToken}
        LIMIT 1
      `;
      const url = Array.isArray(rows) && rows[0] ? rows[0].url : null;
      if (url && /^https?:\/\//i.test(String(url))) target = String(url);
    } catch {}

    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || null;
      const ua = req.headers.get('user-agent') || null;
      const referer = req.headers.get('referer') || null;
      await sql`INSERT INTO whatsapp_promo_clicks (token, ip, ua, referer)
                VALUES (${safeToken}, ${ip}, ${ua}, ${referer})`;
    } catch {}
  }

  return NextResponse.redirect(target, 302);
}
