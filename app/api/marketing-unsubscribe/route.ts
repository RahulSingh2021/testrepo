import { NextRequest, NextResponse } from 'next/server';
import { recordUnsubscribe, verifyUnsubscribeToken } from '@/lib/marketingUnsubscribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-click unsubscribe target reached from the footer of every bulk email.
// The token is HMAC-signed → the recipient can't unsubscribe an arbitrary
// email by hand-rolling the URL. Returns a tiny inline HTML confirmation
// page so even mail clients without referer / cookies show a clean result.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t') || '';
  const email = verifyUnsubscribeToken(token);
  const ua = request.headers.get('user-agent') || '';
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;

  let okMessage = '';
  let errorMessage = '';
  if (!email) {
    errorMessage = 'This unsubscribe link is invalid or has expired. If you keep receiving emails you do not want, please reply to one of them and ask us to remove you.';
  } else {
    try {
      await recordUnsubscribe(email, { source: 'one_click', userAgent: ua.slice(0, 200), ip });
      okMessage = `You have been unsubscribed. We will not send you any more marketing emails at ${email}.`;
    } catch {
      errorMessage = 'We could not record your unsubscribe right now. Please try again in a moment.';
    }
  }

  const safe = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe — SafeFood Mitra Training</title>
<style>
  body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b}
  .wrap{max-width:520px;margin:60px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
  .header{background:#4F46E5;padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:20px;font-weight:900;letter-spacing:-.5px}
  .body{padding:32px}
  .body p{font-size:15px;line-height:1.6;margin:0 0 12px}
  .ok{color:#059669;font-weight:800}
  .err{color:#dc2626;font-weight:800}
</style></head><body>
<div class="wrap">
  <div class="header"><h1>SafeFood Mitra · Training</h1></div>
  <div class="body">
    ${okMessage ? `<p class="ok">${safe(okMessage)}</p>` : ''}
    ${errorMessage ? `<p class="err">${safe(errorMessage)}</p>` : ''}
    <p style="font-size:12px;color:#94a3b8;margin-top:18px">If this was a mistake, just reply to one of our emails and we will add you back.</p>
  </div>
</div>
</body></html>`;
  return new NextResponse(html, {
    status: errorMessage ? 400 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
