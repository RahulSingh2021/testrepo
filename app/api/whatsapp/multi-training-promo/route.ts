import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { sendWhatsAppText, sendWhatsAppTemplateBody, logOutboundMessage } from '@/lib/whatsappSendCore';

// 8-char URL-safe token for the per-blast tracking link.
// Lowercase base36, easy to type, low collision risk for our volume.
function generateBlastToken(): string {
  return randomBytes(6).toString('base64')
    .replace(/\+/g, '').replace(/\//g, '').replace(/=/g, '')
    .slice(0, 8);
}

// Two image-header templates — server picks per recipient based on
// whether we have a real (non-empty) name for them:
//
//   • DEFAULT_TEMPLATE_UNNAMED  — when no name is on file. Body has 2
//     variables: {{1}} = multi-line training details, {{2}} = registration
//     details (URL or short block). Header is an image.
//   • DEFAULT_TEMPLATE_NAMED    — when a name is on file. Body has 3
//     variables: {{1}} = recipient name, {{2}} = registration details,
//     {{3}} = multi-line training details. Header is an image.
//
// The phone/email contact lines are baked into the approved template
// body as STATIC text and are no longer sent as variables.
const DEFAULT_TEMPLATE_UNNAMED = 'calender_food_safety';
const DEFAULT_TEMPLATE_NAMED   = 'food_safety_training';
const DEFAULT_LANGUAGE = 'en';

// "Promote multiple trainings" fan-out endpoint.
//
// Unlike the single-training promo (which uses the approved Meta template
// `training_session_scheduled`), a multi-training digest doesn't fit any
// pre-approved template — the body is a free-form, variable-length list.
// So this route uses `sendWhatsAppText` (Meta `type:'text'`), which only
// works for recipients inside the 24-hour customer-service window.
//
// For cold contacts the API will return error 131047 ("re-engagement");
// `sendWhatsAppText` already surfaces that hint, and we propagate it to
// the per-recipient failure list so the admin sees exactly who needs a
// template-based send instead.
//
// Audience sources
// ----------------
//   • lms_users               (LMS portal accounts)
//   • marketing_participants  (CSV-imported leads, optional)
// Phones are normalised + deduped across both tables.

type Row = { id: string; data: any };

const normalizePhone = (raw: any): string | null => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

async function loadAudience(includeImported: boolean): Promise<
  Array<{ phone: string; name?: string; source: 'lms' | 'imported' }>
> {
  const seen = new Set<string>();
  const out: Array<{ phone: string; name?: string; source: 'lms' | 'imported' }> = [];

  // LMS users — opted in by default (skip explicit opt-outs).
  try {
    const lms: any = await sql`SELECT id, data FROM lms_users`;
    const rows: Row[] = Array.isArray(lms) ? lms : [];
    for (const r of rows) {
      const u = r?.data || {};
      if (u?.receiveTrainingAlerts === false) continue;
      const phone = normalizePhone(u?.phone || u?.whatsapp || u?.mobile);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      out.push({ phone, name: u?.name || u?.fullName, source: 'lms' });
    }
  } catch (err) {
    console.error('multi-training-promo: lms_users load failed', err);
  }

  // Imported marketing leads — only if the admin asked for them.
  if (includeImported) {
    try {
      const mp: any = await sql`SELECT id, data FROM marketing_participants`;
      const rows: Row[] = Array.isArray(mp) ? mp : [];
      for (const r of rows) {
        const u = r?.data || {};
        const raw = u?.mobile ? `${u?.countryCode || ''}${u?.mobile}` : (u?.whatsapp || u?.phone || '');
        const phone = normalizePhone(raw);
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        out.push({ phone, name: u?.fullName || u?.name, source: 'imported' });
      }
    } catch (err) {
      console.error('multi-training-promo: marketing_participants load failed', err);
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;

  let body: any = {};
  try { body = await req.json(); } catch {}

  const trainingIds: string[] = Array.isArray(body?.trainingIds) ? body.trainingIds.filter((s: any) => typeof s === 'string') : [];
  const includeImported = body?.audience === 'lms+imported';
  const dryRun = body?.dryRun === true;
  // Per-recipient opt-out: admin can exclude specific phones from the
  // recipient picker UI. Phones are normalised to digits-only before
  // comparison so UI-formatted values still match.
  const excludePhonesRaw: string[] = Array.isArray(body?.excludePhones) ? body.excludePhones : [];
  const excludePhones = new Set(
    excludePhonesRaw
      .map((p: any) => String(p || '').replace(/\D/g, ''))
      .filter((p: string) => p.length >= 10)
  );
  // 'template' (default) → Meta-approved utility template, reaches cold
  // contacts. 'text' → free-form, only delivers inside the 24-hour window
  // but useful for previewing what the message will look like.
  const mode: 'template' | 'text' = body?.mode === 'text' ? 'text' : 'template';
  // Per-recipient template selection. Legacy `templateName` (if sent)
  // is honored as a fallback for both, so old callers keep working.
  const legacyTemplateName = String(body?.templateName || '').trim();
  const namedTemplateName = (
    String(body?.namedTemplateName || body?.multiTemplateName || '').trim() ||
    legacyTemplateName ||
    DEFAULT_TEMPLATE_NAMED
  );
  const unnamedTemplateName = (
    String(body?.unnamedTemplateName || body?.singleTemplateName || '').trim() ||
    legacyTemplateName ||
    DEFAULT_TEMPLATE_UNNAMED
  );
  const languageCode = String(body?.languageCode || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;

  // Template mode body inputs:
  //   • trainingsList     — multi-line block describing the trainings
  //   • registrationUrl   — registration URL or short details ({{2}})
  //   • headerImageUrl    — single image used in the header of BOTH
  //                         templates for every recipient in this blast
  // contactLine is accepted for back-compat but no longer used as a
  // template variable — the approved templates now have phone/email as
  // static text in their body.
  const trainingsList = String(body?.trainingsList || '').trim();
  const registrationUrl = String(body?.registrationUrl || '').trim();
  const headerImageUrl = String(body?.headerImageUrl || '').trim();

  // Text mode (kept for compatibility / quick previews): single message.
  const message = String(body?.message || '').trim();

  if (trainingIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'Select at least one training.' }, { status: 400 });
  }
  if (!dryRun) {
    if (mode === 'text' && message.length < 20) {
      return NextResponse.json({ ok: false, error: 'Message body is too short.' }, { status: 400 });
    }
    if (mode === 'template') {
      if (!trainingsList) return NextResponse.json({ ok: false, error: 'Trainings list is required for template send.' }, { status: 400 });
      if (!registrationUrl) return NextResponse.json({ ok: false, error: 'Registration URL is required for template send.' }, { status: 400 });
      if (!headerImageUrl) return NextResponse.json({ ok: false, error: 'Header image URL is required for template send.' }, { status: 400 });
    }
  }

  const allRecipients = await loadAudience(includeImported);
  // Apply admin's per-recipient exclusions (only for actual sends; the
  // dryRun preview returns the full list so the picker can render it).
  const recipients = dryRun
    ? allRecipients
    : allRecipients.filter(r => !excludePhones.has(r.phone));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      total: allRecipients.length,
      breakdown: {
        lms: allRecipients.filter(r => r.source === 'lms').length,
        imported: allRecipients.filter(r => r.source === 'imported').length,
      },
      recipients: allRecipients.map(r => ({
        phone: r.phone,
        name: r.name || '',
        source: r.source,
      })),
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      failed: 0,
      total: 0,
      message: 'No eligible recipients.',
    });
  }

  // Fan out with bounded concurrency. Plain text sends are cheap on Meta's
  // side (no template render) but we still cap at 6 in flight to stay
  // friendly with the rate limiter and avoid burst-error 80007.
  const CONC = 6;
  let cursor = 0;
  let sent = 0;
  let failed = 0;
  const failures: Array<{ phone: string; error: string; hint?: string }> = [];

  // Server-side origin used by sendWhatsAppTemplateBody to fetch
  // local-path image headers (e.g. "/uploads/foo.jpg") before
  // uploading to Meta media. Public https URLs go directly via `link`.
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host  = req.headers.get('host') || '';
  const origin = host ? `${proto}://${host}` : '';

  // Per-blast click tracking — one short link, same for every recipient.
  // The /r/<token> route records the click and 302-redirects to the
  // original registrationUrl (preserved in the audit row).
  const blastToken = mode === 'template' ? generateBlastToken() : null;
  const trackedUrl = (blastToken && origin)
    ? `${origin}/rb/${blastToken}`
    : registrationUrl;

  // Per-recipient outcome captured for the blast detail screen.
  const recipientResults: Array<{
    phone: string;
    name: string;
    source: 'lms' | 'imported';
    templateUsed: string | null;
    status: 'sent' | 'failed';
    error: string | null;
    wamid: string | null;
  }> = [];

  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= recipients.length) return;
      const r = recipients[i];
      try {
        // Per-recipient template branching:
        //   • real name on file → namedTemplateName, body
        //     [name, registrationUrl, trainingsList]
        //   • no name on file   → unnamedTemplateName, body
        //     [trainingsList, registrationUrl]
        // Both templates carry the SAME image header for this blast.
        const realName = String(r.name || '').trim();
        const hasName = realName.length > 0;
        const tplName = mode === 'template'
          ? (hasName ? namedTemplateName : unnamedTemplateName)
          : '';
        const templateParams = hasName
          ? [realName, trackedUrl, trainingsList]
          : [trainingsList, trackedUrl];
        const res = mode === 'template'
          ? await sendWhatsAppTemplateBody(
              r.phone,
              tplName,
              templateParams,
              languageCode,
              [], // no text-header params; image header takes precedence
              headerImageUrl,
              origin,
            )
          : await sendWhatsAppText(r.phone, message);
        recipientResults.push({
          phone: r.phone,
          name: realName,
          source: r.source,
          templateUsed: mode === 'template' ? tplName : null,
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? null : (res.error || 'send failed'),
          wamid: res.messageId || null,
        });
        // Template sends are already logged inside sendWhatsAppTemplateBody.
        // Only mirror text sends + failures here so we don't double-log.
        if (mode === 'text' || !res.ok) {
          try {
            await logOutboundMessage({
              wamid: res.messageId || null,
              phone: r.phone,
              messageType: mode === 'template' ? 'template' : 'text',
              body: mode === 'template' ? `${trainingsList}\n\n${registrationUrl}`.slice(0, 1000) : message,
              templateName: mode === 'template' ? tplName : null,
              status: res.ok ? 'sent' : 'failed',
              error: res.ok ? null : (res.error || null),
              raw: res.meta?.raw || null,
            });
          } catch {}
        }
        if (res.ok) sent++;
        else { failed++; failures.push({ phone: r.phone, error: res.error || 'send failed', hint: res.hint }); }
      } catch (err: any) {
        failed++;
        const msg = err?.message || String(err);
        failures.push({ phone: r.phone, error: msg });
        recipientResults.push({
          phone: r.phone,
          name: String(r.name || '').trim(),
          source: r.source,
          templateUsed: null,
          status: 'failed',
          error: msg,
          wamid: null,
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, recipients.length) }, () => worker()));

  // Best-effort audit row so admins can see when a digest blast happened.
  try {
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_multi_training_promos (
      id SERIAL PRIMARY KEY,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      training_ids TEXT[] NOT NULL,
      attempted INT NOT NULL,
      succeeded INT NOT NULL,
      failed INT NOT NULL,
      data JSONB
    )`;
    // Lazy migration — older rows may not have these columns yet.
    await sql`ALTER TABLE whatsapp_multi_training_promos ADD COLUMN IF NOT EXISTS token TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS whatsapp_multi_training_promos_token_idx ON whatsapp_multi_training_promos(token)`;
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_promo_clicks (
      id BIGSERIAL PRIMARY KEY,
      token TEXT NOT NULL,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip TEXT,
      ua TEXT,
      referer TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS whatsapp_promo_clicks_token_idx ON whatsapp_promo_clicks(token, clicked_at DESC)`;

    await sql`INSERT INTO whatsapp_multi_training_promos
      (training_ids, attempted, succeeded, failed, token, data)
      VALUES (${trainingIds}, ${recipients.length}, ${sent}, ${failed}, ${blastToken},
              ${JSON.stringify({
                audience: includeImported ? 'lms+imported' : 'lms',
                mode,
                namedTemplateName: mode === 'template' ? namedTemplateName : null,
                unnamedTemplateName: mode === 'template' ? unnamedTemplateName : null,
                headerImageUrl: mode === 'template' ? headerImageUrl : null,
                registrationUrl: mode === 'template' ? registrationUrl : null,
                trackedUrl: mode === 'template' ? trackedUrl : null,
                trainingsList: mode === 'template' ? trainingsList : null,
                messagePreview: (mode === 'template' ? `${trainingsList}\n\n${trackedUrl}` : message).slice(0, 280),
                recipients: recipientResults,
              })}::jsonb)`;
  } catch (err) {
    console.error('multi-training-promo: audit insert failed (non-fatal)', err);
  }

  return NextResponse.json({
    ok: true,
    total: recipients.length,
    sent,
    failed,
    failures: failures.slice(0, 50),
    trackedUrl: blastToken ? trackedUrl : null,
    blastToken,
    breakdown: {
      lms: recipients.filter(r => r.source === 'lms').length,
      imported: recipients.filter(r => r.source === 'imported').length,
    },
  });
}
