// SMTP email via Nodemailer — sender: training@safefoodmitra.co.in
//
// Required environment variables (set as Replit secrets):
//   SMTP_HOST                       e.g. smtp.gmail.com
//   SMTP_PORT                       465 (SSL) or 587 (STARTTLS)
//   SMTP_USER                       full mailbox address, e.g. training@safefoodmitra.co.in
//   SMTP_PASS                       Gmail/Workspace App Password (16 chars, no spaces)
//
// Optional:
//   SMTP_SECURE                     "true" forces TLS, "false" forces STARTTLS;
//                                   if unset, secure = (port === 465)
//   SMTP_TLS_REJECT_UNAUTHORIZED    "false" to allow self-signed certs (default: true)
//
// Rotating the Gmail App Password:
//   1. Sign in to the mailbox at https://myaccount.google.com/security
//   2. Enable 2-Step Verification if not already on
//   3. Visit https://myaccount.google.com/apppasswords — create a new password
//      named "HACCP PRO LMS"
//   4. Copy the 16-character password (Google shows it with spaces — paste WITHOUT spaces)
//   5. Update the SMTP_PASS secret in the Replit "Secrets" tab and restart the workflow

import nodemailer, { type Transporter } from 'nodemailer';
import { createTrackingRow, buildTrackingPixelTag } from '@/lib/emailTracking';

const SENDER_EMAIL = 'training@safefoodmitra.co.in';
const SENDER_NAME  = 'SafeFood Mitra Training';

export interface SendEmailError {
  code?: string;
  responseCode?: number;
  message: string;
}
export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: SendEmailError;
}

let cachedTransporter: Transporter | null = null;
let verifyPromise: Promise<void> | null = null;

function buildTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  // Gmail/Workspace App Passwords are displayed as "xxxx xxxx xxxx xxxx" (16 chars + spaces).
  // Strip any whitespace so the secret works whether the operator pasted it with or without spaces.
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (!host || !user || !pass) {
    throw new Error('[Email] SMTP credentials not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing)');
  }

  const secureEnv = (process.env.SMTP_SECURE || '').toLowerCase();
  const secure = secureEnv === 'true' ? true
                : secureEnv === 'false' ? false
                : port === 465;

  const rejectUnauthorized = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  });
}

function getTransporter(): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = buildTransporter();
    // Verify once per process so credential breakage is logged loudly on first use.
    verifyPromise = cachedTransporter.verify()
      .then(() => {
        console.log(`[Email] SMTP transport verified — host=${process.env.SMTP_HOST} port=${process.env.SMTP_PORT} user=${process.env.SMTP_USER}`);
      })
      .catch((err: any) => {
        console.error(`[Email] SMTP transport verification FAILED — host=${process.env.SMTP_HOST} port=${process.env.SMTP_PORT} user=${process.env.SMTP_USER} code=${err?.code} responseCode=${err?.responseCode} message=${err?.message}`);
      });
  }
  return cachedTransporter;
}

function describeError(err: any): SendEmailError {
  return {
    code: err?.code,
    responseCode: err?.responseCode,
    message: err?.message || String(err),
  };
}

type Attachment = { filename: string; content: Buffer; contentType?: string };

async function sendSmtpEmail(
  to: string,
  subject: string,
  htmlBody: string,
  template: string,
  attachments?: Attachment[],
): Promise<SendEmailResult> {
  let transporter: Transporter;
  try {
    transporter = getTransporter();
  } catch (err: any) {
    const error = describeError(err);
    console.error(`[Email] Skipping send — transport unavailable. template=${template} to=${to} error=${error.message}`);
    return { ok: false, error };
  }
  // Wait for the verify probe so the first-attempt log clearly shows
  // whether credentials are healthy before attempting a real send.
  if (verifyPromise) { try { await verifyPromise; } catch { /* logged above */ } }

  try {
    const info = await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to,
      replyTo: SENDER_EMAIL,
      subject,
      html: htmlBody,
      attachments,
    });
    console.log(`[Email] Sent template=${template} to=${to} messageId=${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err: any) {
    const error = describeError(err);
    console.error(`[Email] Send FAILED template=${template} to=${to} code=${error.code} responseCode=${error.responseCode} message=${error.message}`);
    return { ok: false, error };
  }
}

const brandColor = '#4F46E5';
const brandBg    = '#F5F3FF';

function htmlWrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:${brandColor};padding:28px 32px;text-align:center}
  .header h1{margin:0;font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px}
  .header p{margin:4px 0 0;font-size:11px;color:#c7d2fe;font-weight:700;letter-spacing:2px;text-transform:uppercase}
  .body{padding:28px 32px}
  .body p{margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155}
  .highlight{background:${brandBg};border:1.5px solid #c7d2fe;border-radius:12px;padding:16px 20px;margin:18px 0}
  .highlight .label{font-size:10px;font-weight:900;color:${brandColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:6px}
  .highlight .value{font-size:22px;font-weight:900;color:${brandColor};letter-spacing:2px;font-family:monospace}
  .tile-row{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}
  .tile{flex:1;min-width:120px;background:#f8fafc;border-radius:10px;padding:12px 14px;border:1px solid #e2e8f0}
  .tile .tl{font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
  .tile .tv{font-size:13px;font-weight:800;color:#1e293b}
  .btn{display:inline-block;background:${brandColor};color:#fff!important;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:900;font-size:13px;margin:10px 0}
  .footer{background:#f1f5f9;padding:16px 32px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0}
  .divider{border:none;border-top:1px solid #f1f5f9;margin:18px 0}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>HACCP PRO · LMS</h1>
    <p>${title}</p>
  </div>
  <div class="body">${body}</div>
  <div class="footer">
    © HACCP PRO &nbsp;·&nbsp; Food Safety Intelligence &nbsp;·&nbsp;
    This email was sent to you because you registered for a training session.
  </div>
</div>
</body></html>`;
}

// Optional resource links shown at the bottom of every registration-flow
// email so the registrant has one consolidated place to find the WhatsApp
// group, the live meeting link, and our public socials. All fields are
// optional — the block only renders for the links that are present.
export interface ResourceLinks {
  meetingLink?:   string | null;
  whatsappLink?:  string | null;
  instagramLink?: string | null;
  linkedinLink?:  string | null;
}

function buildResourceLinksHtml(p: ResourceLinks): string {
  const safe = (s: string) => s.replace(/[<>"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const meeting   = (p.meetingLink   || '').trim();
  const whatsapp  = (p.whatsappLink  || '').trim();
  const instagram = (p.instagramLink || '').trim();
  const linkedin  = (p.linkedinLink  || '').trim();
  if (!meeting && !whatsapp && !instagram && !linkedin) return '';

  const meetingBlock = meeting ? `
<div style="background:${brandBg};border:1.5px solid #c7d2fe;border-radius:12px;padding:14px 18px;margin:14px 0">
  <div style="font-size:10px;font-weight:900;color:${brandColor};text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Live Training Meeting Link</div>
  <p style="margin:0 0 10px;font-size:12px;color:#475569">Join the live session at the scheduled time. Save this link — we will also resend it as a reminder closer to the date.</p>
  <p style="margin:0;text-align:center">
    <a class="btn" href="${safe(meeting)}" target="_blank" rel="noopener" style="margin:6px 0">Join the Session</a>
  </p>
  <div style="font-size:11px;font-family:monospace;color:${brandColor};word-break:break-all;margin-top:6px">${safe(meeting)}</div>
</div>` : '';

  const socialChips = [
    whatsapp  && { url: whatsapp,  label: 'WhatsApp Group', bg: '#dcfce7', fg: '#166534', border: '#86efac' },
    instagram && { url: instagram, label: 'Instagram',      bg: '#fce7f3', fg: '#9d174d', border: '#f9a8d4' },
    linkedin  && { url: linkedin,  label: 'LinkedIn',       bg: '#dbeafe', fg: '#1e3a8a', border: '#93c5fd' },
  ].filter(Boolean) as Array<{ url: string; label: string; bg: string; fg: string; border: string }>;

  const socialBlock = socialChips.length > 0 ? `
<div style="margin:14px 0">
  <div style="font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Stay Connected</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    ${socialChips.map(c => `<a href="${safe(c.url)}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;background:${c.bg};color:${c.fg}!important;border:1px solid ${c.border};border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800">${c.label} →</a>`).join('')}
  </div>
</div>` : '';

  return `<hr class="divider">${meetingBlock}${socialBlock}`;
}

export interface FreeConfirmationParams extends ResourceLinks {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  sessionMode: string;
  sessionLocation?: string;
  trainer: string;
  myCouponCode?: string | null;
  couponDiscount?: number | null;
  couponCommission?: number | null;
  couponActiveFrom?: string | null;
  couponExpiresAt?: string | null;
  couponMaxUses?: number;
}

export async function sendFreeRegistrationConfirmation(p: FreeConfirmationParams): Promise<SendEmailResult> {
  const couponHtml = p.myCouponCode ? `
<hr class="divider">
<p><strong>Your Personal Refer &amp; Earn Coupon is ready!</strong></p>
<div class="highlight">
  <div class="label">Your Coupon Code</div>
  <div class="value">${p.myCouponCode}</div>
</div>
<div class="tile-row">
  <div class="tile"><div class="tl">Friend saves</div><div class="tv">₹${p.couponDiscount?.toLocaleString('en-IN') ?? '—'}</div></div>
  <div class="tile"><div class="tl">You earn per use</div><div class="tv">₹${p.couponCommission?.toLocaleString('en-IN') ?? '—'}</div></div>
  <div class="tile"><div class="tl">Max uses</div><div class="tv">${p.couponMaxUses ?? 5}</div></div>
  <div class="tile"><div class="tl">Maximum you earn (total)</div><div class="tv">₹${((p.couponCommission ?? 0) * (p.couponMaxUses ?? 5)).toLocaleString('en-IN')}</div></div>
</div>
<p style="font-size:12px;color:#64748b">
  Share this code with friends &amp; colleagues. It becomes active from <strong>${p.couponActiveFrom ?? '—'}</strong> and expires on <strong>${p.couponExpiresAt ?? '—'}</strong>.
</p>
` : '';

  const body = `
<p>Dear <strong>${p.name}</strong>,</p>
<p>Thank you for registering! Your spot is <strong style="color:#059669">confirmed</strong> for the upcoming training session.</p>
<div class="tile-row">
  <div class="tile"><div class="tl">Course</div><div class="tv">${p.sessionTitle}</div></div>
  <div class="tile"><div class="tl">Date</div><div class="tv">${p.sessionDate}</div></div>
  <div class="tile"><div class="tl">Time</div><div class="tv">${p.sessionTime}</div></div>
  <div class="tile"><div class="tl">Mode</div><div class="tv">${p.sessionMode}${p.sessionLocation ? ' · ' + p.sessionLocation : ''}</div></div>
  <div class="tile"><div class="tl">Trainer</div><div class="tv">${p.trainer}</div></div>
</div>
${couponHtml}
${buildResourceLinksHtml(p)}
<p style="margin-top:20px;font-size:12px;color:#64748b">If you have any questions, reply to this email or contact us via WhatsApp.</p>`;

  return sendSmtpEmail(p.to, `✅ Registration Confirmed — ${p.sessionTitle}`, htmlWrap('Registration Confirmed', body), 'free_registration_confirmation');
}

export interface PaidPendingParams extends ResourceLinks {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  sessionMode: string;
  sessionLocation?: string;
  trainer: string;
  utrNumber?: string;
  courseFee?: number;
  couponDiscount?: number | null;
  couponCommission?: number | null;
  couponMaxUses?: number;
}

export async function sendPaidRegistrationPending(p: PaidPendingParams): Promise<SendEmailResult> {
  const couponPreview = (p.couponDiscount && p.couponDiscount > 0) || (p.couponCommission && p.couponCommission > 0) ? `
<hr class="divider">
<p><strong>Refer &amp; Earn — coming to you after payment is verified!</strong></p>
<p style="font-size:13px;color:#334155">
  Once your payment is confirmed, you will receive a personal promo code to share with others.<br>
  Here's what to expect:
</p>
<div class="tile-row">
  <div class="tile"><div class="tl">Friend saves</div><div class="tv">₹${(p.couponDiscount ?? 0).toLocaleString('en-IN')}</div></div>
  <div class="tile"><div class="tl">You earn per use</div><div class="tv">₹${(p.couponCommission ?? 0).toLocaleString('en-IN')}</div></div>
  <div class="tile"><div class="tl">Max uses</div><div class="tv">${p.couponMaxUses ?? 5}</div></div>
  <div class="tile"><div class="tl">Maximum you earn (total)</div><div class="tv">₹${((p.couponCommission ?? 0) * (p.couponMaxUses ?? 5)).toLocaleString('en-IN')}</div></div>
</div>
<p style="font-size:11px;color:#94a3b8">Your promo code will be emailed separately once payment is verified. It will be active from the day after the training.</p>
` : '';

  const body = `
<p>Dear <strong>${p.name}</strong>,</p>
<p>Thank you for registering for <strong>${p.sessionTitle}</strong>. We have received your payment details and your registration is currently <strong style="color:#D97706">pending verification</strong>.</p>
<div class="tile-row">
  <div class="tile"><div class="tl">Course</div><div class="tv">${p.sessionTitle}</div></div>
  <div class="tile"><div class="tl">Date</div><div class="tv">${p.sessionDate}</div></div>
  <div class="tile"><div class="tl">Time</div><div class="tv">${p.sessionTime}</div></div>
  <div class="tile"><div class="tl">Mode</div><div class="tv">${p.sessionMode}${p.sessionLocation ? ' · ' + p.sessionLocation : ''}</div></div>
  ${p.utrNumber ? `<div class="tile"><div class="tl">UTR Ref</div><div class="tv">${p.utrNumber}</div></div>` : ''}
  ${p.courseFee ? `<div class="tile"><div class="tl">Fee</div><div class="tv">₹${p.courseFee.toLocaleString('en-IN')}</div></div>` : ''}
</div>
<p style="font-size:13px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:12px 16px;color:#92400E">
  ⏳ <strong>What happens next:</strong> Our team will verify your UPI payment (UTR: ${p.utrNumber ?? '—'}) within 1 business day. You will receive a confirmation email once approved.
</p>
${couponPreview}
${buildResourceLinksHtml(p)}
<p style="margin-top:20px;font-size:12px;color:#64748b">If you have any questions, reply to this email or contact us via WhatsApp.</p>`;

  return sendSmtpEmail(p.to, `⏳ Registration Received — Payment Pending — ${p.sessionTitle}`, htmlWrap('Registration Received', body), 'paid_registration_pending');
}

export interface CouponEarnedParams {
  to: string;
  ownerName: string;
  usedByName: string;
  sessionTitle: string;
  amountEarned: number;
  totalEarned: number;
  usesRemaining: number;
  maxUses: number;
}

export async function sendCouponEarnedNotification(p: CouponEarnedParams): Promise<SendEmailResult> {
  const body = `
<p>Dear <strong>${p.ownerName}</strong>,</p>
<p>🎉 Great news! Someone just registered using your referral coupon and your payment has been <strong style="color:#059669">verified</strong>. You've earned a commission!</p>
<div class="tile-row">
  <div class="tile"><div class="tl">Used by</div><div class="tv">${p.usedByName}</div></div>
  <div class="tile"><div class="tl">Session</div><div class="tv">${p.sessionTitle}</div></div>
  <div class="tile"><div class="tl">You earned</div><div class="tv" style="color:#059669;font-size:18px">₹${p.amountEarned.toLocaleString('en-IN')}</div></div>
  <div class="tile"><div class="tl">Total earned (this coupon)</div><div class="tv">₹${p.totalEarned.toLocaleString('en-IN')}</div></div>
</div>
<div class="highlight">
  <div class="label">Uses Remaining</div>
  <div class="value">${p.usesRemaining} / ${p.maxUses}</div>
</div>
<p style="font-size:13px;color:#334155">
  Keep sharing your coupon code — you can earn up to <strong>₹${(p.amountEarned * p.usesRemaining).toLocaleString('en-IN')}</strong> more from the remaining ${p.usesRemaining} use${p.usesRemaining !== 1 ? 's' : ''}!
</p>
<p style="font-size:12px;color:#64748b;margin-top:16px">Your earnings will be credited to your affiliate wallet. Contact us if you have any questions.</p>`;

  return sendSmtpEmail(
    p.to,
    `🎉 You earned ₹${p.amountEarned.toLocaleString('en-IN')}! Someone used your referral coupon — ${p.sessionTitle}`,
    htmlWrap('Referral Earnings Credited', body),
    'coupon_earned',
  );
}

export interface PaymentVerifiedParams extends ResourceLinks {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  sessionMode: string;
  sessionLocation?: string;
  trainer: string;
  myCouponCode?: string | null;
  couponDiscount?: number | null;
  couponCommission?: number | null;
  couponActiveFrom?: string | null;
  couponExpiresAt?: string | null;
  couponMaxUses?: number;
}

export async function sendPaymentVerifiedEmail(p: PaymentVerifiedParams & {
  // When the per-event auto-send-on-verify is active, the meeting link is
  // delivered by the dedicated meeting-link send (email and/or WhatsApp per
  // the admin's channel choice). Pass true here to keep this confirmation
  // email link-free so recipients get exactly one source of truth for the
  // joining link and the admin's channel selection is honoured.
  suppressMeetingLink?: boolean;
}): Promise<SendEmailResult> {
  const couponHtml = p.myCouponCode ? `
<hr class="divider">
<p><strong>🎉 Your Refer &amp; Earn Coupon Code</strong></p>
<div class="highlight">
  <div class="label">Your Coupon Code</div>
  <div class="value">${p.myCouponCode}</div>
</div>
<div class="tile-row">
  <div class="tile"><div class="tl">Friend saves</div><div class="tv">₹${p.couponDiscount?.toLocaleString('en-IN') ?? '—'}</div></div>
  <div class="tile"><div class="tl">You earn per use</div><div class="tv">₹${p.couponCommission?.toLocaleString('en-IN') ?? '—'}</div></div>
  <div class="tile"><div class="tl">Max uses</div><div class="tv">${p.couponMaxUses ?? 5}</div></div>
  <div class="tile"><div class="tl">Maximum you earn (total)</div><div class="tv">₹${((p.couponCommission ?? 0) * (p.couponMaxUses ?? 5)).toLocaleString('en-IN')}</div></div>
</div>
<p style="font-size:12px;color:#64748b">
  Share this coupon with friends — they save ₹${p.couponDiscount?.toLocaleString('en-IN') ?? '—'} per registration, and you earn ₹${p.couponCommission?.toLocaleString('en-IN') ?? '—'} each time someone uses it.<br>
  Code is active from <strong>${p.couponActiveFrom ?? '—'}</strong> through <strong>${p.couponExpiresAt ?? '—'}</strong>.
</p>
` : '';

  const body = `
<p>Dear <strong>${p.name}</strong>,</p>
<p>Great news! Your payment has been <strong style="color:#059669">verified</strong>. Your seat is confirmed for:</p>
<div class="tile-row">
  <div class="tile"><div class="tl">Course</div><div class="tv">${p.sessionTitle}</div></div>
  <div class="tile"><div class="tl">Date</div><div class="tv">${p.sessionDate}</div></div>
  <div class="tile"><div class="tl">Time</div><div class="tv">${p.sessionTime}</div></div>
  <div class="tile"><div class="tl">Mode</div><div class="tv">${p.sessionMode}${p.sessionLocation ? ' · ' + p.sessionLocation : ''}</div></div>
  <div class="tile"><div class="tl">Trainer</div><div class="tv">${p.trainer}</div></div>
</div>
${couponHtml}
${buildResourceLinksHtml(p.suppressMeetingLink ? { ...p, meetingLink: null } : p)}
${p.suppressMeetingLink ? '<p style="font-size:12px;color:#64748b;margin-top:14px">Your joining link is being sent in a separate message. Please watch for it shortly.</p>' : ''}
<p style="margin-top:20px;font-size:12px;color:#64748b">See you at the training! If you have any questions, feel free to reply to this email.</p>`;

  return sendSmtpEmail(p.to, `✅ Payment Verified — ${p.sessionTitle}`, htmlWrap('Payment Confirmed', body), 'payment_verified');
}

export interface MeetingLinkParams extends ResourceLinks {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  trainer?: string;
  meetingLink: string;
  customNote?: string;
}

export async function sendMeetingLinkEmail(p: MeetingLinkParams & {
  sessionId?: string;
  registrantId?: string;
}): Promise<SendEmailResult> {
  const safeNote = (p.customNote || '').trim();
  const noteHtml = safeNote
    ? `<p style="font-size:13px;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:12px 16px;color:#3730A3;white-space:pre-wrap">${safeNote.replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch] || ch))}</p>`
    : '';
  const body = `
<p>Dear <strong>${p.name}</strong>,</p>
<p>Here is the joining link for your upcoming training session. Please save this email and join a few minutes before the start time.</p>
<div class="tile-row">
  <div class="tile"><div class="tl">Course</div><div class="tv">${p.sessionTitle}</div></div>
  <div class="tile"><div class="tl">Date</div><div class="tv">${p.sessionDate}</div></div>
  <div class="tile"><div class="tl">Time</div><div class="tv">${p.sessionTime}</div></div>
  ${p.trainer ? `<div class="tile"><div class="tl">Trainer</div><div class="tv">${p.trainer}</div></div>` : ''}
</div>
<p style="text-align:center;margin:22px 0">
  <a class="btn" href="${p.meetingLink}" target="_blank" rel="noopener">Join the Session</a>
</p>
<div class="highlight">
  <div class="label">Meeting Link</div>
  <div style="font-size:12px;font-family:monospace;color:${brandColor};word-break:break-all">${p.meetingLink}</div>
</div>
${noteHtml}
${buildResourceLinksHtml({
    // Don't repeat the meeting link in the resource block — it's already
    // the headline of this email. Only show the social chips here.
    whatsappLink:  p.whatsappLink,
    instagramLink: p.instagramLink,
    linkedinLink:  p.linkedinLink,
})}
<p style="margin-top:20px;font-size:12px;color:#64748b">If the button doesn't work, copy and paste the link above into your browser. Reply to this email if you have any trouble joining.</p>`;

  const subject = `Joining Link — ${p.sessionTitle}`;
  // Create a tracking row first so we can stitch the open-tracking pixel into
  // the body. If tracking creation fails we still send the email — just
  // without the pixel — so deliverability never depends on tracking.
  const trackingId = await createTrackingRow({
    template:        'meeting_link_broadcast',
    recipientEmail:  p.to,
    recipientName:   p.name,
    subject,
    sessionId:       p.sessionId,
    registrantId:    p.registrantId,
  });
  const tracked = trackingId ? body + '\n' + buildTrackingPixelTag(trackingId) : body;

  return sendSmtpEmail(
    p.to,
    // NOTE: avoid the 📅 calendar emoji here — Apple Mail / iOS render it
    // as a tile showing "JUL 17" (the Unicode reference glyph), which looks
    // like the wrong date to recipients. Plain text is safer cross-client.
    subject,
    htmlWrap('Your Joining Link', tracked),
    'meeting_link_broadcast',
  );
}

// ── Bulk marketing email ────────────────────────────────────────────────────
// Free-form rich-text body authored in the LMS Bulk Email composer. The body
// HTML must be sanitised + token-expanded by the caller; this helper only
// wraps it in the shared brand chrome and ships it via the same SMTP
// transport every transactional template uses.
export interface MarketingBulkParams {
  to: string;
  subject: string;
  bodyHtml: string;          // already token-expanded + sanitized + footer-appended
  attachments?: Attachment[]; // optional file attachments forwarded to nodemailer
}

export async function sendMarketingBulkEmail(p: MarketingBulkParams): Promise<SendEmailResult> {
  return sendSmtpEmail(
    p.to,
    p.subject,
    htmlWrap(p.subject, p.bodyHtml),
    'marketing_bulk',
    p.attachments && p.attachments.length > 0 ? p.attachments : undefined,
  );
}

export interface CertificateEmailParams {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  trainer?: string;
  pdfBase64: string;       // raw base64, no data: prefix
  pdfFilename?: string;
  customNote?: string;
}

export async function sendCertificateEmail(p: CertificateEmailParams & {
    sessionId?: string;
    registrantId?: string;
}): Promise<SendEmailResult> {
  const safeNote = (p.customNote || '').trim();
  const noteHtml = safeNote
    ? `<p style="font-size:13px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:12px 16px;color:#92400E;white-space:pre-wrap">${safeNote.replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch] || ch))}</p>`
    : '';
  const filename = (p.pdfFilename || `Certificate_${p.name}.pdf`).replace(/[^\w.\- ]+/g, '_');
  const body = `
<p>Dear <strong>${p.name}</strong>,</p>
<p>Congratulations on completing <strong>${p.sessionTitle}</strong>! Your certificate of participation is attached to this email as a PDF.</p>
<div class="tile-row">
  <div class="tile"><div class="tl">Course</div><div class="tv">${p.sessionTitle}</div></div>
  <div class="tile"><div class="tl">Date</div><div class="tv">${p.sessionDate}</div></div>
  ${p.trainer ? `<div class="tile"><div class="tl">Trainer</div><div class="tv">${p.trainer}</div></div>` : ''}
</div>
${noteHtml}
<p style="margin-top:20px;font-size:12px;color:#64748b">If the attachment doesn't open, please reply to this email and we'll resend it. Keep this certificate for your records.</p>`;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = Buffer.from(p.pdfBase64, 'base64');
  } catch {
    return { ok: false, error: { message: 'Invalid PDF payload (not valid base64).' } };
  }

  const subject = `Your Certificate — ${p.sessionTitle}`;
  const trackingId = await createTrackingRow({
    template:        'certificate_email',
    recipientEmail:  p.to,
    recipientName:   p.name,
    subject,
    sessionId:       p.sessionId,
    registrantId:    p.registrantId,
  });
  const tracked = trackingId ? body + '\n' + buildTrackingPixelTag(trackingId) : body;

  return sendSmtpEmail(
    p.to,
    subject,
    htmlWrap('Your Certificate', tracked),
    'certificate_email',
    [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
  );
}
