// WhatsApp Business Cloud API (Meta)
// Credentials required (set as Replit secrets):
//   WHATSAPP_ACCESS_TOKEN     — permanent System User token from Meta Developer Console
//   WHATSAPP_PHONE_NUMBER_ID  — Phone Number ID from Meta Developer Console (not the phone number itself)
//
// All messages use pre-approved Meta message templates (type: "template").
// Template names are prefixed with "haccp_" and must be submitted to Meta for approval
// before they can be used. See docs/whatsapp-setup.md for full instructions.

const WA_API_VERSION = 'v20.0';

interface WhatsAppMessageResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string; type: string; code: number };
}

function toE164(phone: string): string {
  return phone.replace(/[\s\-\+\(\)]/g, '');
}

// Meta WhatsApp Cloud API rejects template body/header text params that
// contain '\n', '\t', or 5+ consecutive spaces — even when the template
// itself was approved with multi-line samples. Flatten any multi-line
// value into a single visual line using bullets between former fields and
// a heavy diamond between blank-line-separated cards.
//
// Separator design notes:
//   • FIELD_SEP — small bullet, narrow padding. Used for "joins" within
//     one logical card so fields stay grouped visually.
//   • CARD_SEP  — heavy diamond plus the maximum allowed run of spaces
//     (4 each side, Meta's hard cap is "no 5+ consecutive spaces"). On
//     mobile this padding lets the wrapper break BEFORE the diamond
//     more often, anchoring the next card on a fresh line and keeping
//     adjacent cards from running together as one wall of text.
// Mirrors the renderer used by the referral-usage digest route and
// whatsappSendCore.sendWhatsAppTemplateBody — keep all three in lockstep.
const FIELD_SEP = '  •  ';
const CARD_SEP  = '    ✦ ━━ ✦    ';
export function flattenForWhatsApp(raw: any): string {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(block => block.split('\n').map(l => l.trim()).filter(Boolean).join(FIELD_SEP))
    .filter(Boolean)
    .join(CARD_SEP)
    .replace(/\t/g, ' ')
    .replace(/ {5,}/g, '    ')
    .slice(0, 1024)
    .trim();
}

// Walk a `components` array and apply flattenForWhatsApp() to every
// `{ type: 'text', text }` parameter on body/header components. Leaves
// non-text params (images, currency, date_time, etc.) untouched.
function sanitizeComponents(components: any[]): any[] {
  return components.map((c) => {
    if (!c || typeof c !== 'object' || !Array.isArray((c as any).parameters)) return c;
    const t = String((c as any).type || '');
    if (t !== 'body' && t !== 'header') return c;
    return {
      ...c,
      parameters: (c as any).parameters.map((p: any) => {
        if (p && p.type === 'text' && typeof p.text === 'string') {
          return { ...p, text: flattenForWhatsApp(p.text) };
        }
        return p;
      }),
    };
  });
}

async function sendTemplate(
  to: string,
  templateName: string,
  components: object[],
): Promise<boolean> {
  const token     = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

  if (!token || !phoneNumId) {
    console.warn('[WhatsApp] Skipping send — WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set.');
    return false;
  }

  const e164 = toE164(to);
  if (!e164 || e164.length < 7) {
    console.warn(`[WhatsApp] Skipping send to invalid number: "${to}"`);
    return false;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: e164,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: sanitizeComponents(components as any[]),
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json() as WhatsAppMessageResponse;
    if (json?.messages?.[0]?.id) {
      console.log(`[WhatsApp] Sent "${templateName}" to ${e164} — WA message ID: ${json.messages[0].id}`);
      return true;
    }
    console.error(`[WhatsApp] Send failed for "${templateName}" to ${e164}:`, JSON.stringify(json));
    return false;
  } catch (err) {
    console.error(`[WhatsApp] fetch error for "${templateName}":`, err);
    return false;
  }
}

// ─── Template 1: Free session registration confirmed ─────────────────────────
// Template name : haccp_free_registration_confirmed
// Always sends all 8 body parameters. When no Refer & Earn coupon is configured,
// {{6}}, {{7}}, {{8}} are sent as "—" so the placeholder count stays fixed and
// always matches the approved Meta template structure.
// Approved template body (submit to Meta as-is):
//   Hi {{1}}, your registration for *{{2}}* is confirmed! 🎉
//   📅 Date: {{3}}
//   ⏰ Time: {{4}}
//   📍 Mode: {{5}}
//   We look forward to seeing you. For any queries, reply to this message or call +918239008202.
//   🎁 Your referral code: *{{6}}*. Friends save ₹{{7}}, you earn ₹{{8}} per referral — share with colleagues!

export interface WaFreeConfirmationParams {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  sessionMode: string;
  myCouponCode?: string | null;
  couponDiscount?: number | null;
  couponCommission?: number | null;
}

export async function sendWhatsAppFreeConfirmation(p: WaFreeConfirmationParams): Promise<boolean> {
  return sendTemplate(p.to, 'haccp_free_registration_confirmed', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.name },
        { type: 'text', text: p.sessionTitle },
        { type: 'text', text: p.sessionDate || '—' },
        { type: 'text', text: p.sessionTime || '—' },
        { type: 'text', text: p.sessionMode || '—' },
        { type: 'text', text: p.myCouponCode ?? '—' },
        { type: 'text', text: p.couponDiscount != null ? String(p.couponDiscount) : '—' },
        { type: 'text', text: p.couponCommission != null ? String(p.couponCommission) : '—' },
      ],
    },
  ]);
}

// ─── Template 2: Paid registration — payment pending ─────────────────────────
// Template name : haccp_payment_pending
// Body text (submit to Meta):
//   Hi {{1}}, we've received your registration for *{{2}}*. ✅
//   Your payment (UTR: {{3}}) is under verification.
//   Once confirmed, you'll receive a WhatsApp message and email with your seat confirmation.
//   For help: +918239008202 or safefoodmitra@gmail.com

export interface WaPaymentPendingParams {
  to: string;
  name: string;
  sessionTitle: string;
  utrNumber: string;
}

export async function sendWhatsAppPaymentPending(p: WaPaymentPendingParams): Promise<boolean> {
  return sendTemplate(p.to, 'haccp_payment_pending', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.name },
        { type: 'text', text: p.sessionTitle },
        { type: 'text', text: p.utrNumber || '—' },
      ],
    },
  ]);
}

// ─── Template 3: Payment verified — seat confirmed ────────────────────────────
// Template name : haccp_payment_verified
// Body text (submit to Meta):
//   Hi {{1}}, great news! Your payment has been verified. 🎉
//   Your seat for *{{2}}* on {{3}} is confirmed.
//   Your Refer & Earn code: *{{4}}*
//   Share it with friends to earn commissions on future sessions!
//   See you at the training! Contact: +918239008202
//
// Note: {{4}} = coupon code string, or "—" when no Refer & Earn is configured.

export interface WaPaymentVerifiedParams {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  myCouponCode?: string | null;
}

export async function sendWhatsAppPaymentVerified(p: WaPaymentVerifiedParams): Promise<boolean> {
  return sendTemplate(p.to, 'haccp_payment_verified', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.name },
        { type: 'text', text: p.sessionTitle },
        { type: 'text', text: p.sessionDate || '—' },
        { type: 'text', text: p.myCouponCode ?? '—' },
      ],
    },
  ]);
}

// ─── Template 3b: Training payment verified — referral + details ─────────────
// Template name : haccp_training_referral_confirmed   (Utility)
// Body text (submit to Meta verbatim):
//   Dear {{1}},
//
//   Thank you for registering in our training course.
//
//   Your training participation reference details are provided below:
//
//   🎟️ Referral Code: {{2}}
//
//   📌 Training Details:
//   {{3}}
//
//   This referral code may be used during future training registrations or shared for training reference purposes.
//
//   📞 Phone: +91 8239 00 8202
//   📧 Email: safefoodmitra@gmail.com
//
// Variables:
//   {{1}} = registrant name
//   {{2}} = personal referral / Refer & Earn coupon code (or "—")
//   {{3}} = multi-line training details block (topic / date / time / trainer)
//
// NOTE: This template must be created and approved in Meta Business Manager
// (Category = Utility) before sends will succeed. Until approved, the Graph
// API call returns an error and `sendWhatsAppTrainingReferralConfirmed`
// resolves to false (logged but non-fatal).

export interface WaTrainingReferralConfirmedParams {
  to: string;
  name: string;
  referralCode?: string | null;
  trainingDetails: string;
}

export async function sendWhatsAppTrainingReferralConfirmed(
  p: WaTrainingReferralConfirmedParams,
): Promise<boolean> {
  return sendTemplate(p.to, 'haccp_training_referral_confirmed', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.name || 'Participant' },
        { type: 'text', text: (p.referralCode && p.referralCode.trim()) || '—' },
        { type: 'text', text: p.trainingDetails || '—' },
      ],
    },
  ]);
}

// ─── Template 4: Coupon owner earnings notification ──────────────────────────
// Template name : haccp_coupon_earned
// Body text (submit to Meta):
//   Hi {{1}}, someone just used your referral code! 🎉
//   *{{2}}* registered for *{{3}}* using your code.
//   💰 You earned: ₹{{4}}
//   🔢 Uses remaining on your code: {{5}}
//   Keep sharing to earn more! Contact: +918239008202

export interface WaCouponEarnedParams {
  to: string;
  ownerName: string;
  usedByName: string;
  sessionTitle: string;
  amountEarned: number;
  usesRemaining: number;
}

export async function sendWhatsAppCouponEarned(p: WaCouponEarnedParams): Promise<boolean> {
  return sendTemplate(p.to, 'haccp_coupon_earned', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.ownerName },
        { type: 'text', text: p.usedByName },
        { type: 'text', text: p.sessionTitle },
        { type: 'text', text: String(p.amountEarned) },
        { type: 'text', text: String(p.usesRemaining) },
      ],
    },
  ]);
}

// ─── Template 5: Bulk referral-usage digest (2 codes per recipient) ──────────
// Template name : haccp_referral_usage_digest
// Category      : Utility
// Body has 10 vars. The template is sent ONLY to owners with EXACTLY
// two valid (active, non-expired, has-remaining-uses) referral codes.
//
//   Dear {{1}},
//
//   Here are your referral code usage details:
//
//   🎟️ Code: {{2}}
//   📊 Used Count: {{3}}
//   📌 Remaining Valid Usage: {{4}}
//   📅 Expiry Date: {{5}}
//
//   🎟️ Code: {{6}}
//   📊 Used Count: {{7}}
//   📌 Remaining Valid Usage: {{8}}
//   📅 Expiry Date: {{9}}
//
//   📘 Training Details:
//   {{10}}
//
//   These referral codes may be used during future training registrations or
//   shared for training reference purposes.
//
//   📞 Phone: +91 8239 00 8202
//   📧 Email: safefoodmitra@gmail.com
//
//   Thank you!
//   SafeFood Mitra

export interface WaReferralUsageDigestParams {
  to: string;
  name: string;
  // First code
  code1: string;
  used1: number;
  remaining1: number;
  expiry1: string;          // pre-formatted, or '—'
  // Second code
  code2: string;
  used2: number;
  remaining2: number;
  expiry2: string;          // pre-formatted, or '—'
  // {{10}} multi-line training cards block
  trainingDetails: string;
}

export async function sendWhatsAppReferralUsageDigest(
  p: WaReferralUsageDigestParams,
): Promise<boolean> {
  return sendTemplate(p.to, 'haccp_referral_usage_digest', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.name || 'Participant' },
        { type: 'text', text: p.code1 || '—' },
        { type: 'text', text: String(p.used1 ?? 0) },
        { type: 'text', text: String(p.remaining1 ?? 0) },
        { type: 'text', text: p.expiry1 || '—' },
        { type: 'text', text: p.code2 || '—' },
        { type: 'text', text: String(p.used2 ?? 0) },
        { type: 'text', text: String(p.remaining2 ?? 0) },
        { type: 'text', text: p.expiry2 || '—' },
        { type: 'text', text: p.trainingDetails || '—' },
      ],
    },
  ]);
}

// ─── Template 6: Bulk referral-usage digest (1 code per recipient) ───────────
// Template name : haccp_referral_usage_digest_one
// Category      : Utility
// Body has 3 vars. Sent to owners with EXACTLY one valid (active, non-expired,
// has-remaining-uses) referral code. The code/used/remaining/expiry rows are
// pre-rendered server-side and passed in as a single multi-line {{2}}.
//
//   Dear {{1}},
//
//   Here are your referral code usage details:
//
//   {{2}}
//
//   📘 Training Details:
//   {{3}}
//
//   This referral code may be used during future training registrations or
//   shared for training reference purposes.
//
//   📞 Phone: +91 8239 00 8202
//   📧 Email: safefoodmitra@gmail.com
//
//   Thank you!
//   SafeFood Mitra

export interface WaReferralUsageDigestOneParams {
  to: string;
  name: string;
  // Pre-formatted multi-line block for {{2}}, e.g.:
  //   🎟️ Code: ABC123\n📊 Used Count: 0\n📌 Remaining Valid Usage: 5\n📅 Expiry Date: 27 Nov 2026
  codeBlock: string;
  // Multi-line training-cards block for {{3}}.
  trainingDetails: string;
}

export async function sendWhatsAppReferralUsageDigestOne(
  p: WaReferralUsageDigestOneParams,
): Promise<boolean> {
  return sendTemplate(p.to, 'haccp_referral_usage_digest_one', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.name || 'Participant' },
        { type: 'text', text: p.codeBlock || '—' },
        { type: 'text', text: p.trainingDetails || '—' },
      ],
    },
  ]);
}

// ─── Template 7: Training meeting / joining link ────────────────────────────
// Template name : haccp_training_meeting_link
// Category      : Utility
// Variables     : {{1}}=name, {{2}}=topic, {{3}}=date, {{4}}=time, {{5}}=link
//
// Approved template body (submit to Meta verbatim — newlines kept):
//
//   Hi {{1}},
//
//   🎓 Your meeting link for *{{2}}* is ready.
//
//   🗓️ {{3}}
//   ⏰ {{4}}
//   🔗 Join: {{5}}
//
//   If the link doesn't open, copy-paste it into your browser.
//
//   📞 Support: +91 8239 00 8202
//   SafeFood Mitra
//
// NOTE: Until the template is created and approved in Meta Business Manager
// this helper resolves to false (logged but non-fatal).

export interface WaTrainingMeetingLinkParams {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  meetingLink: string;
}

// ─── Template 8: Training certificate (PDF document delivery) ──────────────
// Template name : haccp_training_certificate
// Category      : Utility
// Header type   : DOCUMENT (the certificate PDF — uploaded per-send)
// Variables     : {{1}}=name, {{2}}=topic, {{3}}=date
//
// Suggested approved body (paste into Meta Manager verbatim, keep blank
// lines so the message reads as a card):
//
//   Hi {{1}},
//
//   🏅 Congratulations! Your certificate for *{{2}}* held on {{3}} is
//   attached above.
//
//   Save it for your records and feel free to share it on LinkedIn.
//
//   📞 Support: +91 8239 00 8202
//   SafeFood Mitra
//
// NOTE: Until the template is created and approved with a DOCUMENT header
// in Meta Business Manager, this helper resolves to false (logged but
// non-fatal). The route caller will translate that into a per-recipient
// failure so the bulk send keeps marching down the list.

export interface WaTrainingCertificateParams {
  to: string;
  name: string;
  sessionTitle: string;
  sessionDate: string;
  pdfBase64: string;          // raw base64 (no data: prefix)
  pdfFilename?: string;       // optional display name in WhatsApp
}

export async function sendWhatsAppTrainingCertificate(
  p: WaTrainingCertificateParams,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  // Lazy-import the core helper so this file (which is also imported
  // from edge-ish bundles) doesn't pay the cost when the certificate
  // path is unused.
  const core = await import('./whatsappSendCore');
  if (!p.pdfBase64) {
    return { ok: false, error: 'pdfBase64 is required to send a WhatsApp certificate.' };
  }
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = Buffer.from(p.pdfBase64, 'base64');
  } catch {
    return { ok: false, error: 'Invalid base64 PDF payload.' };
  }
  const filename = p.pdfFilename || `Certificate-${(p.name || 'participant').replace(/[^A-Za-z0-9._-]+/g, '_')}.pdf`;
  const result = await core.sendWhatsAppTemplateBodyWithDocument(
    p.to,
    'haccp_training_certificate',
    [
      flattenForWhatsApp(p.name        || 'Participant'),
      flattenForWhatsApp(p.sessionTitle || '—'),
      flattenForWhatsApp(p.sessionDate  || '—'),
    ],
    pdfBuffer,
    filename,
  );
  if (!result.ok) {
    console.warn(`[WhatsApp] Certificate send failed for ${p.to}: ${result.error || result.status}`);
    return { ok: false, error: result.error || `Meta API ${result.status}` };
  }
  return { ok: true, messageId: result.messageId };
}

export async function sendWhatsAppTrainingMeetingLink(
  p: WaTrainingMeetingLinkParams,
): Promise<boolean> {
  // NOTE: The Meta-approved template was registered under this exact name
  // ("template_name_" prefix was accidentally included when the template was
  // submitted). Meta does not allow renaming an approved template, so we
  // call the literal approved name here.
  return sendTemplate(p.to, 'template_name_haccp_training_meeting_link', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: p.name        || 'Participant' },
        { type: 'text', text: p.sessionTitle || '—' },
        { type: 'text', text: p.sessionDate  || '—' },
        { type: 'text', text: p.sessionTime  || '—' },
        { type: 'text', text: p.meetingLink  || '—' },
      ],
    },
  ]);
}
