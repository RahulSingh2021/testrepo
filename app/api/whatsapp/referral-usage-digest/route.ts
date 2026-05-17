import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { sendWhatsAppReferralUsageDigestOne } from '@/lib/sendWhatsApp';

// Bulk WhatsApp blast to referral-code owners.
//
// Eligibility rules (see user spec):
//   • Recipient must have 1 OR MORE valid referral codes.
//   • All recipients use the single approved template
//     `haccp_referral_usage_digest_one` (3 body vars). Every code the owner
//     holds is rendered into the multi-line {{2}} block back-to-back, the
//     same way the {{3}} block stacks N upcoming-training cards.
//   • A code is "valid" iff:
//       - data->>'active' = 'true'
//       - AND (no `expires_at`, OR expires_at > today)
//       - AND current_uses < max_uses
//
// Body shape:
//   POST { dryRun?: boolean, trainingDetails?: string }
//     dryRun=true            → returns { ok, total, recipients: [...] } without sending
//     trainingDetails        → optional override for {{10}}; when omitted the
//                              server auto-builds it from upcoming public
//                              training_calendar rows in the same card style
//                              used by the bulk multi-training promo modal.

const isoToday = (): string => new Date().toISOString().slice(0, 10);

const fmtDate = (d: string): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const normalizePhone = (raw: any): string | null => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

type ValidCoupon = {
  code: string;
  used: number;
  remaining: number;
  expiry: string;          // pre-formatted, or '—'
  expiry_iso: string;      // raw, for sorting; '' when none
  created_at: string;      // raw, for sorting
};

async function loadValidCouponsByOwner(): Promise<Map<string, { ownerName: string; ownerEmail: string; codes: ValidCoupon[] }>> {
  const today = isoToday();
  const out = new Map<string, { ownerName: string; ownerEmail: string; codes: ValidCoupon[] }>();
  let rows: any[] = [];
  try {
    const r: any = await sql`SELECT id, data FROM affiliate_coupons`;
    rows = Array.isArray(r) ? r : [];
  } catch (err) {
    console.error('referral-usage-digest: load affiliate_coupons failed', err);
    return out;
  }

  for (const row of rows) {
    const d = row?.data || {};
    if (String(d.active) !== 'true' && d.active !== true) continue;
    const expIso = String(d.expires_at || '').slice(0, 10);
    if (expIso && expIso <= today) continue;
    const maxUses = Number(d.max_uses ?? 0);
    const cur     = Number(d.current_uses ?? 0);
    const remaining = Math.max(0, maxUses - cur);
    if (maxUses > 0 && remaining <= 0) continue;

    const ownerId = String(d.owner_id || '');
    if (!ownerId) continue;
    const bucket = out.get(ownerId) || {
      ownerName:  String(d.owner_name || '').trim(),
      ownerEmail: String(d.owner_email || '').trim().toLowerCase(),
      codes: [] as ValidCoupon[],
    };
    if (!bucket.ownerName  && d.owner_name)  bucket.ownerName  = String(d.owner_name).trim();
    if (!bucket.ownerEmail && d.owner_email) bucket.ownerEmail = String(d.owner_email).trim().toLowerCase();
    bucket.codes.push({
      code: String(d.code || ''),
      used: cur,
      remaining,
      expiry:     expIso ? fmtDate(expIso) : '—',
      expiry_iso: expIso,
      created_at: String(d.created_at || ''),
    });
    out.set(ownerId, bucket);
  }

  // Sort each owner's codes oldest-created-first so {{2}}-{{5}} is always
  // the older code and {{6}}-{{9}} the newer one — gives a stable order.
  for (const v of out.values()) {
    v.codes.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }
  return out;
}

async function lookupOwnerPhone(ownerId: string, ownerEmail: string): Promise<{ phone: string | null; name: string }> {
  // Primary: lms_users by id
  try {
    const r: any = await sql`SELECT id, data FROM lms_users WHERE id = ${ownerId} LIMIT 1`;
    const rows = Array.isArray(r) ? r : [];
    if (rows.length > 0) {
      const u = rows[0].data || {};
      const phone = normalizePhone(u.phone || u.mobile || u.whatsapp);
      const name  = String(u.name || u.fullName || '').trim();
      if (phone) return { phone, name };
      if (name)  return { phone: null, name };
    }
  } catch {}
  // Fallback: lms_users by email match
  if (ownerEmail) {
    try {
      const r: any = await sql`SELECT id, data FROM lms_users WHERE lower(data->>'email') = ${ownerEmail} LIMIT 1`;
      const rows = Array.isArray(r) ? r : [];
      if (rows.length > 0) {
        const u = rows[0].data || {};
        const phone = normalizePhone(u.phone || u.mobile || u.whatsapp);
        const name  = String(u.name || u.fullName || '').trim();
        if (phone) return { phone, name };
        if (name)  return { phone: null, name };
      }
    } catch {}
    // Last-ditch: any training_registrations row owned by the same email
    try {
      const r: any = await sql`SELECT data FROM training_registrations WHERE lower(data->>'email') = ${ownerEmail} LIMIT 1`;
      const rows = Array.isArray(r) ? r : [];
      if (rows.length > 0) {
        const u = rows[0].data || {};
        const phone = normalizePhone(u.mobile || u.whatsapp || u.phone);
        const name  = String(u.name || u.fullName || '').trim();
        if (phone) return { phone, name };
      }
    } catch {}
  }
  return { phone: null, name: '' };
}

// Strip a leading ISO date prefix from a stored time field. Some calendar
// rows store `startTime` / `endTime` as full ISO datetimes (e.g.
// "2026-05-10T15:00") while newer rows store the bare "HH:MM". Both should
// render as "HH:MM" in the WhatsApp message.
const cleanTime = (raw: any): string => {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Match "...T15:00" or "...T15:00:00" and extract HH:MM.
  const m = s.match(/T(\d{2}:\d{2})/);
  if (m) return m[1];
  // Already HH:MM (or HH:MM:SS) — trim seconds if present.
  const m2 = s.match(/^(\d{2}:\d{2})/);
  return m2 ? m2[1] : s;
};

async function buildUpcomingTrainingsBlock(): Promise<string> {
  const today = isoToday();
  let rows: any[] = [];
  try {
    const r: any = await sql`SELECT id, data FROM training_calendar`;
    rows = Array.isArray(r) ? r : [];
  } catch { return '—'; }

  const upcoming = rows
    .map((row: any) => row?.data || {})
    .filter((t: any) => {
      const date = String(t.date || '').slice(0, 10);
      const isPublic = t.isPublic !== false && t.public !== false;
      return date && date >= today && isPublic;
    })
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 8);

  if (upcoming.length === 0) return '—';

  // Number each card. The flatten step joins cards with CARD_SEP on a
  // single visual line; on a narrow phone the eye loses track of where
  // one session ends and the next begins (every card starts with the
  // word "Topic"). A leading "1)", "2)" gives a stable anchor even when
  // the wrapper crowds two cards onto the same row.
  const showNumbers = upcoming.length > 1;
  const blocks = upcoming.map((t: any, i: number) => {
    const start = cleanTime(t.startTime);
    const end   = cleanTime(t.endTime);
    const time  = [start, end].filter(Boolean).join(' – ');
    const prefix = showNumbers ? `${i + 1}) ` : '';
    const lines: string[] = [`${prefix}🎓 *${t.topic || 'Training'}*`];
    const meta: string[] = [];
    if (t.date) meta.push(`🗓️ ${fmtDate(String(t.date).slice(0, 10))}`);
    if (time)   meta.push(`⏰ ${time}`);
    if (meta.length) lines.push(meta.join('   '));
    if (t.trainer) lines.push(`👨‍🏫 ${t.trainer}`);
    return lines.join('\n');
  });
  return blocks.join('\n\n');
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun = body?.dryRun === true;
  const trainingDetailsOverride = String(body?.trainingDetails || '').trim();

  const byOwner = await loadValidCouponsByOwner();
  // Eligible: 1 OR MORE valid codes per owner. The single approved template
  // handles N codes via the multi-line {{2}} block.
  const eligibleOwners = Array.from(byOwner.entries())
    .filter(([, v]) => v.codes.length >= 1);

  // Build the upcoming-trainings block once for the whole blast.
  const trainingDetails = trainingDetailsOverride || (await buildUpcomingTrainingsBlock());

  // Resolve phones in parallel.
  const resolved = await Promise.all(
    eligibleOwners.map(async ([ownerId, v]) => {
      const { phone, name } = await lookupOwnerPhone(ownerId, v.ownerEmail);
      const finalName = (v.ownerName || name || 'Participant').trim();
      return { ownerId, ownerEmail: v.ownerEmail, name: finalName, phone, codes: v.codes };
    }),
  );

  const recipientsWithPhone = resolved.filter(r => r.phone);
  const recipientsMissingPhone = resolved.filter(r => !r.phone);

  // Pre-render the {{2}} block. WhatsApp Cloud API rejects body params with
  // '\n', '\t', or 5+ spaces; U+2028 passes the validator but renders as
  // an unknown glyph on most phones. So we go fully inline: bullets
  // between fields inside one card, and a horizontal rule between cards.
  const FIELD_SEP = '  •  ';
  // Heavier visual break between cards. 4 spaces (Meta cap) + sparkle +
  // box-rule + sparkle + 4 spaces. The wrapper now nearly always breaks
  // BEFORE the leading spaces, which puts the next card on its own
  // visual line on a phone-sized screen.
  const CARD_SEP  = '    ✦ ━━ ✦    ';
  // When an owner has more than one valid code we number them so the
  // recipient can immediately tell "Code A vs Code B" without parsing
  // the whole inline run. Single-code owners stay unnumbered.
  const renderOneCode = (c: ValidCoupon, idx: number, total: number): string => {
    const prefix = total > 1 ? `${idx + 1}) ` : '';
    return [
      `${prefix}🎫 Code: ${c.code}`,
      `🔢 Used: ${c.used}`,
      `🎁 Remaining: ${c.remaining}`,
      `🗓️ Expiry: ${c.expiry}`,
    ].join(FIELD_SEP);
  };
  const renderCodeBlock = (codes: ValidCoupon[]): string =>
    codes.map((c, i) => renderOneCode(c, i, codes.length)).join(CARD_SEP);

  // Same treatment for the training block — flatten newlines/indents to
  // inline separators so Meta accepts the parameter and the recipient
  // sees a clean single-paragraph list of sessions.
  const flattenForWhatsApp = (raw: string): string =>
    String(raw || '—')
      .replace(/\r\n?/g, '\n')
      // Each session is a 3-line block separated by a blank line. Convert
      // the in-block newlines to FIELD_SEP and the blank-line gaps to
      // CARD_SEP so sessions remain visually distinct.
      .split(/\n{2,}/)
      .map(block => block.split('\n').map(l => l.trim()).filter(Boolean).join(FIELD_SEP))
      .filter(Boolean)
      .join(CARD_SEP)
      .replace(/\t/g, ' ')
      .replace(/ {5,}/g, '    ');
  const safeTrainingDetails = flattenForWhatsApp(trainingDetails);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      total: recipientsWithPhone.length,
      oneCodeCount: recipientsWithPhone.filter(r => r.codes.length === 1).length,
      twoCodeCount: recipientsWithPhone.filter(r => r.codes.length === 2).length,
      multiCodeCount: recipientsWithPhone.filter(r => r.codes.length >= 3).length,
      missingPhone: recipientsMissingPhone.length,
      trainingDetails,
      recipients: recipientsWithPhone.map(r => ({
        name: r.name,
        phone: r.phone,
        codes: r.codes.map(c => c.code),
      })),
    });
  }

  if (recipientsWithPhone.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'No eligible recipients found (need at least 1 valid referral code and a phone on file).',
      missingPhone: recipientsMissingPhone.length,
    }, { status: 400 });
  }

  let sent = 0;
  const failures: Array<{ phone: string; name: string; error: string }> = [];

  // Sequential to keep us well under WhatsApp's per-second rate limits
  // (~80 msg/sec on the standard tier; this stays comfortably below).
  for (const r of recipientsWithPhone) {
    try {
      const ok = await sendWhatsAppReferralUsageDigestOne({
        to: r.phone!,
        name: r.name,
        codeBlock: renderCodeBlock(r.codes),
        trainingDetails: safeTrainingDetails,
      });
      if (ok) sent++;
      else failures.push({ phone: r.phone!, name: r.name, error: 'send_failed (see server logs)' });
    } catch (err: any) {
      failures.push({ phone: r.phone!, name: r.name, error: err?.message || 'exception' });
    }
  }

  return NextResponse.json({
    ok: true,
    total: recipientsWithPhone.length,
    sent,
    failed: failures.length,
    missingPhone: recipientsMissingPhone.length,
    failures: failures.slice(0, 10),
  });
}
