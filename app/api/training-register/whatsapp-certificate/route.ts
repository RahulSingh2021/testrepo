import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { sendWhatsAppTrainingCertificate } from '@/lib/sendWhatsApp';
import { requireAdminSession } from '@/lib/adminAuth';

export const runtime     = 'nodejs';
export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

// POST /api/training-register/whatsapp-certificate
// Body: {
//   to: string,                // recipient phone (digits only, country code first)
//   name: string,
//   sessionTitle: string,
//   sessionDate: string,
//   pdfBase64: string,
//   pdfFilename?: string,
//   registrantId?: string,     // optional — stamps the registrant row when provided
// }
//
// Sends a generated certificate PDF as a WhatsApp document via the
// Meta-approved template `haccp_training_certificate`. Admin-only — same
// auth as the email-certificate / meeting-link routes so we don't get
// spammed by anonymous traffic.

type Body = {
  to?: unknown;
  name?: unknown;
  sessionTitle?: unknown;
  sessionDate?: unknown;
  pdfBase64?: unknown;
  pdfFilename?: unknown;
  registrantId?: unknown;
};

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Phone is digits-only (country code first, no '+' / spaces); the helper
  // re-normalises but we still want to reject obvious garbage early.
  const toRaw = String(body?.to || '').trim();
  const to = toRaw.replace(/[^\d]/g, '');
  if (!to || to.length < 8) {
    return NextResponse.json({ error: 'Valid recipient phone is required (digits with country code).' }, { status: 400 });
  }

  const name         = String(body?.name || '').trim() || 'Participant';
  const sessionTitle = String(body?.sessionTitle || '').trim() || 'Training Session';
  const sessionDate  = String(body?.sessionDate || '').trim();
  const pdfBase64    = String(body?.pdfBase64 || '').trim();
  const pdfFilename  = body?.pdfFilename ? String(body.pdfFilename) : undefined;
  const registrantId = body?.registrantId ? String(body.registrantId) : '';

  if (!pdfBase64) {
    return NextResponse.json({ error: 'pdfBase64 is required.' }, { status: 400 });
  }
  // Reject oversized payloads early — Meta caps documents at 100 MB but
  // /media uploads above ~16 MB are slow and unreliable in practice.
  if (pdfBase64.length > 22 * 1024 * 1024) {
    return NextResponse.json({ error: 'Certificate PDF is too large for WhatsApp (limit ~16MB binary).' }, { status: 413 });
  }

  const result = await sendWhatsAppTrainingCertificate({
    to,
    name,
    sessionTitle,
    sessionDate,
    pdfBase64,
    pdfFilename,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: (result.error || 'WhatsApp send failed.').slice(0, 300) }, { status: 502 });
  }

  // Stamp the registrant row so admins can see who has received their
  // certificate over WhatsApp. Mirrors the email path
  // (`certificateEmailSentAt`) so the UI can render either or both.
  // Stamp errors are logged loudly and surfaced as a `stampError` field
  // on the success response — the WhatsApp message itself was already
  // delivered, so we don't fail the request, but the operator sees the
  // problem in the deployment logs and can investigate.
  let stampError: string | undefined;
  if (registrantId) {
    const stampPatch = JSON.stringify({
      certificateWhatsAppSentAt: new Date().toISOString(),
    });
    try {
      await sql`UPDATE training_registrations SET data = data || ${stampPatch}::jsonb WHERE id = ${registrantId}`;
    } catch (e: any) {
      stampError = e?.message || 'unknown DB error';
      console.error(`[whatsapp-certificate] Failed to stamp registrant ${registrantId}:`, e);
    }
  }

  return NextResponse.json({ success: true, messageId: result.messageId, ...(stampError ? { stampError } : {}) });
}
