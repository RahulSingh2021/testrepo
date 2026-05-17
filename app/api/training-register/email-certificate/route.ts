import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { sendCertificateEmail } from '@/lib/sendEmail';
import { requireAdminSession } from '@/lib/adminAuth';

export const runtime     = 'nodejs';
export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

// POST /api/training-register/email-certificate
// Body: {
//   to: string, name: string, sessionTitle: string, sessionDate: string,
//   trainer?: string, pdfBase64: string, pdfFilename?: string,
//   customNote?: string,
//   registrantId?: string,   // optional — stamps the registrant row when provided
// }
//
// Sends a generated certificate PDF as an email attachment to the participant.
// Admin-only (same auth as the meeting-link broadcast) so we don't get spammed.

type Body = {
    to?: unknown;
    name?: unknown;
    sessionTitle?: unknown;
    sessionDate?: unknown;
    trainer?: unknown;
    pdfBase64?: unknown;
    pdfFilename?: unknown;
    customNote?: unknown;
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

    const to           = String(body?.to || '').trim();
    const name         = String(body?.name || '').trim() || 'Participant';
    const sessionTitle = String(body?.sessionTitle || '').trim() || 'Training Session';
    const sessionDate  = String(body?.sessionDate || '').trim();
    const trainer      = body?.trainer ? String(body.trainer).trim() : undefined;
    const pdfBase64    = String(body?.pdfBase64 || '').trim();
    const pdfFilename  = body?.pdfFilename ? String(body.pdfFilename) : undefined;
    const customNote   = body?.customNote ? String(body.customNote).slice(0, 1000) : '';
    const registrantId = body?.registrantId ? String(body.registrantId) : '';

    if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
        return NextResponse.json({ error: 'Valid recipient email is required.' }, { status: 400 });
    }
    if (!pdfBase64) {
        return NextResponse.json({ error: 'pdfBase64 is required.' }, { status: 400 });
    }
    // Reject obviously oversize payloads early. SMTP servers and the request
    // body parser will choke on very large attachments anyway.
    if (pdfBase64.length > 12 * 1024 * 1024) {
        return NextResponse.json({ error: 'Certificate PDF is too large to email (limit ~9MB).' }, { status: 413 });
    }

    const result = await sendCertificateEmail({
        to, name, sessionTitle, sessionDate, trainer,
        pdfBase64, pdfFilename, customNote,
        registrantId: registrantId || undefined,
    });

    if (!result.ok) {
        const msg = result.error?.message || 'Email failed.';
        return NextResponse.json({ success: false, error: msg.slice(0, 300) }, { status: 502 });
    }

    // Best-effort: stamp the registrant row so admins can see who's been emailed
    // their certificate. Non-fatal if the row id wasn't supplied or the update fails.
    if (registrantId) {
        const stampPatch = JSON.stringify({
            certificateEmailSentAt: new Date().toISOString(),
        });
        try {
            await sql`UPDATE training_registrations SET data = data || ${stampPatch}::jsonb WHERE id = ${registrantId}`;
        } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
}
