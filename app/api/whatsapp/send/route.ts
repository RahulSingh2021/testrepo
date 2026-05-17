import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppTemplate, type SendBody } from '@/lib/whatsappSendCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Thin HTTP wrapper around `sendWhatsAppTemplate` (lib/whatsappSendCore.ts).
// All real send/template/normalisation logic lives in the lib so the
// promo worker can invoke it directly without an HTTP round-trip — see
// the comment at the top of `lib/whatsappSendCore.ts` for the full
// rationale.
export async function POST(req: NextRequest) {
  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const origin = req.nextUrl?.origin || `http://localhost:${process.env.PORT || 5000}`;
  const result = await sendWhatsAppTemplate(body, origin);
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      template: result.template,
      to: result.to,
    });
  }
  return NextResponse.json(
    { ok: false, error: result.error, hint: result.hint, meta: result.meta },
    { status: result.status },
  );
}
