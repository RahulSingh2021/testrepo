import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import crypto from 'crypto';
import {
  sendFreeRegistrationConfirmation,
  sendPaidRegistrationPending,
  sendPaymentVerifiedEmail,
  sendCouponEarnedNotification,
} from '@/lib/sendEmail';
import {
  sendWhatsAppFreeConfirmation,
  sendWhatsAppPaymentPending,
  sendWhatsAppTrainingReferralConfirmed,
  sendWhatsAppCouponEarned,
} from '@/lib/sendWhatsApp';
import { startEmailRetryScheduler } from '@/lib/retryFailedEmails';
import { resolveWaContact } from '@/lib/countryDialingCodes';
import {
  readAutoSendSettings,
  assertMeetingLinkOrError,
  dispatchMeetingLinkAutoSend,
} from '@/lib/meetingLinkAutoSend';

// Kick off the background scheduler the first time this module is loaded.
startEmailRetryScheduler();

const MAX_EMAIL_ATTEMPTS = 5;
const RETRY_BACKOFF_MIN = [15, 30, 60, 120, 240];
function computeNextRetry(attempts: number): string {
  const idx = Math.max(0, Math.min(attempts - 1, RETRY_BACKOFF_MIN.length - 1));
  return new Date(Date.now() + RETRY_BACKOFF_MIN[idx] * 60_000).toISOString();
}

const ensureTables = async () => {
  await sql`CREATE TABLE IF NOT EXISTS training_registrations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_training_reg_session ON training_registrations(session_id)`;
  await sql`CREATE TABLE IF NOT EXISTS lms_users (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const ensureAffiliateTables = async () => {
  await sql`CREATE TABLE IF NOT EXISTS affiliate_coupons (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_transactions (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_wallets (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_settings (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  // Enforce one personal coupon per (owner_email, session_id) at the DB level
  // so two concurrent payment-verification PATCHes for the same registrant
  // can never end up creating two active coupons for the same training. The
  // index is partial (only applies when both keys are non-empty) so it does
  // not interfere with admin-issued / generic coupons.
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS affiliate_coupons_owner_session_uq
              ON affiliate_coupons ((data->>'owner_email'), (data->>'session_id'))
              WHERE (data->>'owner_email') IS NOT NULL
                AND (data->>'owner_email') <> ''
                AND (data->>'session_id')  IS NOT NULL
                AND (data->>'session_id')  <> ''`;
  } catch (err) {
    // Pre-existing duplicates (created before this index was added) would
    // make CREATE UNIQUE INDEX fail; log and continue so the rest of the
    // affiliate flows keep working. Backfill/dedupe is handled separately.
    console.warn('ensureAffiliateTables: unique owner+session index not created (likely pre-existing duplicates):', err);
  }
};

function buildCouponCode(sessionId: string, email: string, mobile: string): string {
  const emailPart = (email.split('@')[0] || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const mobilePart = mobile.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const sessionPart = sessionId.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-4).padStart(4, '0');
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${emailPart}${mobilePart}${sessionPart}${randomPart}`;
}

async function markNotificationSent(registrationId: string, field: string) {
  try {
    const now = new Date().toISOString();
    const patch = JSON.stringify({
      [field]: now,
      // Clear any prior failure / retry markers for this channel.
      [`${field}FailedAt`]: null,
      [`${field}Error`]: null,
      [`${field}NextRetryAt`]: null,
      [`${field}GiveUpAt`]: null,
    });
    await sql`UPDATE training_registrations SET data = data || ${patch}::jsonb WHERE id = ${registrationId}`;
  } catch { /* non-fatal */ }
}

async function markNotificationFailed(
  registrationId: string,
  field: string,
  error: { code?: string; responseCode?: number; message: string } | null,
  recipient: string,
  template: string,
  retryPayload?: any,
) {
  try {
    const now = new Date().toISOString();
    // Read current attempt count so we can increment & decide give-up.
    let attempts = 1;
    try {
      const safeId = registrationId.replace(/'/g, "''");
      const r = await sql.unsafe(`SELECT data FROM training_registrations WHERE id = '${safeId}' LIMIT 1`);
      const rows = Array.isArray(r) ? r : (r as any)?.rows || [];
      if (rows.length > 0) {
        attempts = (Number(rows[0].data?.[`${field}Attempts`]) || 0) + 1;
      }
    } catch { /* non-fatal */ }
    const giveUp = attempts >= MAX_EMAIL_ATTEMPTS;
    const patch: Record<string, any> = {
      [`${field}FailedAt`]: now,
      [`${field}Error`]: {
        code: error?.code ?? null,
        responseCode: error?.responseCode ?? null,
        message: (error?.message || 'unknown').slice(0, 500),
        template,
        recipient,
      },
      [`${field}Attempts`]: attempts,
      [`${field}NextRetryAt`]: giveUp ? null : computeNextRetry(attempts),
      [`${field}RetryTemplate`]: template,
      [`${field}RetryRecipient`]: recipient,
    };
    if (retryPayload) patch[`${field}RetryPayload`] = retryPayload;
    if (giveUp) patch[`${field}GiveUpAt`] = now;
    await sql`UPDATE training_registrations SET data = data || ${JSON.stringify(patch)}::jsonb WHERE id = ${registrationId}`;
  } catch { /* non-fatal */ }
}

function handleEmailResult(id: string, field: string, template: string, recipient: string, retryPayload?: any) {
  return (result: { ok: boolean; error?: { code?: string; responseCode?: number; message: string } }) => {
    if (result?.ok) {
      markNotificationSent(id, field);
    } else {
      console.error(`[Email] Persisting failure for registration=${id} template=${template} to=${recipient} error=${result?.error?.message}`);
      markNotificationFailed(id, field, result?.error || null, recipient, template, retryPayload);
    }
  };
}

async function autoGenerateRegistrantCoupon(
  registrationId: string,
  sessionId: string,
  sessionTitle: string,
  sessionDate: string,
  registrantName: string,
  registrantEmail: string,
  registrantPhone: string,
  couponDiscount: number,
  couponCommission: number,
): Promise<{ code: string; activeFrom: string; expiresAt: string; discount: number; commission: number } | null> {
  if (couponDiscount <= 0 && couponCommission <= 0) return null;
  try {
    await ensureAffiliateTables();

    const activeFromDate = sessionDate
      ? (() => {
          const d = new Date(sessionDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })()
      : new Date().toISOString().slice(0, 10);
    const expiresAtDate = (() => {
      const d = new Date(activeFromDate + 'T00:00:00');
      d.setMonth(d.getMonth() + 6);
      return d.toISOString().slice(0, 10);
    })();

    const safeEmail   = registrantEmail.replace(/'/g, "''");
    const safeSession = sessionId.replace(/'/g, "''");

    let existingRows: any[] = [];
    try {
      const existingResult = await sql.unsafe(
        `SELECT id, data FROM affiliate_coupons WHERE data->>'owner_email' = '${safeEmail}' AND data->>'session_id' = '${safeSession}' LIMIT 1`
      );
      existingRows = Array.isArray(existingResult) ? existingResult : [];
    } catch { existingRows = []; }
    if (existingRows.length > 0) {
      const d = existingRows[0].data || {};
      return {
        code: d.code,
        activeFrom: d.active_from || activeFromDate,
        expiresAt: d.expires_at || expiresAtDate,
        discount: Number(d.discount_amount) || couponDiscount,
        commission: Number(d.commission_amount) || couponCommission,
      };
    }

    let code = buildCouponCode(sessionId, registrantEmail, registrantPhone);
    for (let i = 0; i < 10; i++) {
      let checkRows: any[] = [];
      try {
        const safeCode = code.replace(/'/g, "''");
        const check = await sql.unsafe(`SELECT id FROM affiliate_coupons WHERE data->>'code' = '${safeCode}' LIMIT 1`);
        checkRows = Array.isArray(check) ? check : [];
      } catch { checkRows = []; }
      if (checkRows.length === 0) break;
      code = buildCouponCode(sessionId, registrantEmail, registrantPhone + i);
    }

    const couponId = `afc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const couponData = {
      code,
      owner_id: registrationId,
      owner_name: registrantName,
      owner_email: registrantEmail,
      owner_mobile: registrantPhone,
      session_id: sessionId,
      session_title: sessionTitle,
      discount_amount: couponDiscount,
      commission_amount: couponCommission,
      max_uses: 5,
      current_uses: 0,
      total_commission_earned: 0,
      active: true,
      active_from: activeFromDate,
      expires_at: expiresAtDate,
      created_at: new Date().toISOString(),
    };
    const couponJson = JSON.stringify(couponData);
    try {
      await sql`INSERT INTO affiliate_coupons (id, data, updated_at) VALUES (${couponId}, ${couponJson}::jsonb, NOW()) ON CONFLICT DO NOTHING`;
    } catch (insertErr) {
      // Race against another concurrent issuance: the new
      // affiliate_coupons_owner_session_uq unique index blocks the second
      // writer. Fall through to a re-SELECT and return whichever coupon
      // ultimately landed first so both callers converge on the same code.
      console.warn(`AutoCoupon: insert blocked (likely concurrent issuance), falling back to re-select for ${registrantEmail}/${sessionId}:`, insertErr);
    }
    // Re-select after insert (or insert-blocked) so we always return the
    // canonical persisted row — its code may differ from `code` if a
    // concurrent writer beat us to it.
    try {
      const finalRes = await sql.unsafe(
        `SELECT data FROM affiliate_coupons WHERE data->>'owner_email' = '${safeEmail}' AND data->>'session_id' = '${safeSession}' LIMIT 1`
      );
      const finalRows = Array.isArray(finalRes) ? finalRes : [];
      if (finalRows.length > 0) {
        const f = finalRows[0].data || {};
        console.log(`AutoCoupon: Generated/loaded ${f.code} for ${registrantEmail} active from ${f.active_from || activeFromDate} expires ${f.expires_at || expiresAtDate}`);
        return {
          code: f.code || code,
          activeFrom: f.active_from || activeFromDate,
          expiresAt: f.expires_at || expiresAtDate,
          discount: Number(f.discount_amount) || couponDiscount,
          commission: Number(f.commission_amount) || couponCommission,
        };
      }
    } catch {}
    console.log(`AutoCoupon: Generated ${code} for ${registrantEmail} active from ${activeFromDate} expires ${expiresAtDate}`);
    return { code, activeFrom: activeFromDate, expiresAt: expiresAtDate, discount: couponDiscount, commission: couponCommission };
  } catch (err) {
    console.error('AutoCoupon: Failed to generate:', err);
    return null;
  }
}

async function processTrainingAffiliateCredit(
  couponCode: string,
  sessionId: string,
  sessionTitle: string,
  courseFee: number,
  registrantName: string,
  registrationId: string,
  registrantEmail: string,
): Promise<{ ownerEmail: string; ownerPhone: string; ownerName: string; amountEarned: number; totalEarned: number; usesRemaining: number; maxUses: number } | null> {
  try {
    await ensureAffiliateTables();

    let couponResult;
    try {
      couponResult = await sql`SELECT id, data FROM affiliate_coupons WHERE data->>'code' = ${couponCode.toUpperCase()} AND data->>'active' = 'true' LIMIT 1`;
    } catch { couponResult = null; }
    const couponRows = Array.isArray(couponResult) ? couponResult : [];
    if (couponRows.length === 0) return null;

    const coupon = couponRows[0].data;
    const couponId = couponRows[0].id;
    if (Number(coupon.current_uses) >= Number(coupon.max_uses)) return null;

    const ownerId: string = coupon.owner_id;
    const ownerName: string = coupon.owner_name;
    const ownerEmail: string = coupon.owner_email || '';

    let existingTxResult;
    try {
      existingTxResult = await sql`SELECT id FROM affiliate_transactions WHERE data->>'session_id' = ${sessionId} AND data->>'enrollee_email' = ${registrantEmail} AND data->>'type' = 'commission' LIMIT 1`;
    } catch { existingTxResult = null; }
    const existingTxRows = Array.isArray(existingTxResult) ? existingTxResult : [];
    if (existingTxRows.length > 0) {
      console.log('TrainingAffiliate: Duplicate commission blocked — this email+session already has a commission');
      return null;
    }

    if (courseFee <= 0) return null;
    const commissionAmount = Number(coupon.commission_amount) > 0
      ? Number(coupon.commission_amount)
      : 0;
    if (commissionAmount <= 0) return null;

    const updatedCoupon = {
      ...coupon,
      current_uses: (Number(coupon.current_uses) || 0) + 1,
      total_commission_earned: (Number(coupon.total_commission_earned) || 0) + commissionAmount,
    };
    const couponJson = JSON.stringify(updatedCoupon);
    await sql`UPDATE affiliate_coupons SET data = ${couponJson}::jsonb, updated_at = NOW() WHERE id = ${couponId}`;

    const txId = `aftx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const txData = {
      owner_id: ownerId,
      owner_name: ownerName,
      coupon_id: couponId,
      coupon_code: coupon.code,
      session_id: sessionId,
      course_name: sessionTitle,
      commission_amount: commissionAmount,
      enrollee_name: registrantName,
      enrollee_email: registrantEmail,
      registration_id: registrationId,
      source: 'training',
      type: 'commission',
      created_at: new Date().toISOString(),
    };
    const txJson = JSON.stringify(txData);
    await sql`INSERT INTO affiliate_transactions (id, data, updated_at) VALUES (${txId}, ${txJson}::jsonb, NOW())`;

    let walletResult;
    try {
      walletResult = await sql`SELECT id, data FROM affiliate_wallets WHERE data->>'user_id' = ${ownerId} LIMIT 1`;
    } catch { walletResult = null; }
    const walletRows = Array.isArray(walletResult) ? walletResult : [];
    if (walletRows.length > 0) {
      const existing = walletRows[0].data;
      const updated = {
        ...existing,
        balance: (Number(existing.balance) || 0) + commissionAmount,
        total_earned: (Number(existing.total_earned) || 0) + commissionAmount,
        updated_at: new Date().toISOString(),
      };
      const walletJson = JSON.stringify(updated);
      await sql`UPDATE affiliate_wallets SET data = ${walletJson}::jsonb, updated_at = NOW() WHERE id = ${walletRows[0].id}`;
    } else {
      const walletId = `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const walletData = {
        user_id: ownerId,
        user_name: ownerName,
        balance: commissionAmount,
        total_earned: commissionAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const walletJson = JSON.stringify(walletData);
      await sql`INSERT INTO affiliate_wallets (id, data, updated_at) VALUES (${walletId}, ${walletJson}::jsonb, NOW())`;
    }

    const newUses = (Number(coupon.current_uses) || 0) + 1;
    const maxUses = Number(coupon.max_uses) || 5;
    console.log(`TrainingAffiliate: Commission ₹${commissionAmount} credited to ${ownerName} (${ownerId}) for session ${sessionId}`);
    return {
      ownerEmail,
      ownerPhone: coupon.owner_mobile || '',
      ownerName,
      amountEarned: commissionAmount,
      totalEarned: (Number(coupon.total_commission_earned) || 0) + commissionAmount,
      usesRemaining: Math.max(0, maxUses - newUses),
      maxUses,
    };
  } catch (err) {
    console.error('TrainingAffiliate: Credit failed (non-fatal):', err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const email = searchParams.get('email');
    const whatsapp = searchParams.get('whatsapp');
    const countsOnly = searchParams.get('counts') === 'true';

    if (countsOnly) {
      let rows: any[] = [];
      try {
        rows = await sql`SELECT session_id, COUNT(*)::int AS cnt FROM training_registrations GROUP BY session_id` as any[];
      } catch {}
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.session_id] = r.cnt;
      // Per-session count of registrants who have already been broadcast
      // the WhatsApp group invite. Lets the SessionCard show a
      // "X of Y invited" indicator without first opening the panel.
      let sentRows: any[] = [];
      try {
        sentRows = await sql`SELECT session_id, COUNT(*)::int AS cnt FROM training_registrations WHERE data ? 'groupLinkSentAt' AND data->>'groupLinkSentAt' IS NOT NULL GROUP BY session_id` as any[];
      } catch {}
      const groupLinkSentCounts: Record<string, number> = {};
      for (const r of sentRows) groupLinkSentCounts[r.session_id] = r.cnt;
      return NextResponse.json({ counts, groupLinkSentCounts });
    }

    let result;
    try {
      if (email || whatsapp) {
        const contactConditions: string[] = [];
        if (email) contactConditions.push(`data->>'email' = '${email.replace(/'/g, "''")}'`);
        if (whatsapp) contactConditions.push(`data->>'whatsapp' = '${whatsapp.replace(/'/g, "''")}'`);
        const contactClause = contactConditions.join(' OR ');
        result = await sql.unsafe(`SELECT id, session_id, data, created_at FROM training_registrations WHERE (${contactClause}) ORDER BY created_at DESC LIMIT 1`);
      } else
      if (sessionId) {
        result = await sql`SELECT id, session_id, data, created_at FROM training_registrations WHERE session_id = ${sessionId} ORDER BY created_at DESC`;
      } else {
        result = await sql`SELECT id, session_id, data, created_at FROM training_registrations ORDER BY created_at DESC`;
      }
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      createdAt: r.created_at,
      ...r.data,
    }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('training-register GET error:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

// Common keys that apply to every participant in a multi-participant batch.
// When the new `participants` array is provided, these top-level fields (if
// present) are spread into each participant unless the participant already
// supplies its own value.
const SHARED_PARTICIPANT_FIELDS = ['country', 'profession', 'instituteName', 'designation'] as const;

interface ProcessedParticipant {
  id: string;
  data: Record<string, any>;
  generatedCoupon: { code: string; activeFrom: string; expiresAt: string } | null;
}

async function processOneParticipant(opts: {
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  participant: Record<string, any>;
  shared: Record<string, any>;
  couponCode?: string;
  couponDiscount?: number;
  couponOwnerId?: string;
  batchId?: string;
  batchIndex?: number;
  batchSize?: number;
  sessionCalData: any;
}): Promise<ProcessedParticipant> {
  const { sessionId, sessionTitle, sessionDate, participant, shared, couponCode, couponDiscount, couponOwnerId, batchId, batchIndex, batchSize, sessionCalData } = opts;
  const rest = { ...shared, ...participant };

  const id = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const data: Record<string, any> = {
    sessionTitle,
    sessionDate,
    ...rest,
    ...(couponCode ? { couponCode, couponDiscount: couponDiscount || 0, couponOwnerId: couponOwnerId || '' } : {}),
    ...(batchId ? { batchId, batchIndex, batchSize } : {}),
  };
  const jsonData = JSON.stringify(data);
  await sql`INSERT INTO training_registrations (id, session_id, data)
            VALUES (${id}, ${sessionId}, ${jsonData}::jsonb)
            ON CONFLICT (id) DO NOTHING`;

  // LMS user upsert per participant
  const lmsId = `lms-reg-${id}`;
  const lmsData = JSON.stringify({
    name: rest.name,
    email: rest.email,
    phone: rest.whatsapp || '',
    organization: rest.instituteName || rest.profession || 'Registrant',
    department: rest.designation || '',
    role: 'learner',
    status: 'active',
    joinedAt: new Date().toISOString(),
    coursesEnrolled: 1,
    coursesCompleted: 0,
    sourceRegistration: id,
  });
  await sql`INSERT INTO lms_users (id, data, updated_at)
            VALUES (${lmsId}, ${lmsData}::jsonb, NOW())
            ON CONFLICT (id) DO UPDATE SET data = ${lmsData}::jsonb, updated_at = NOW()`;

  // ── Move imported marketing contact → training source ────────────────────
  // If this person was previously sitting in the Participants Database as an
  // "imported" row (CSV upload / paste, often with only a phone number and
  // missing name/email), delete that row now. The training_registrations
  // entry we just created is the new source of truth, so the next GET to
  // /api/marketing-participants will surface them under the LMS source —
  // this is what prevents the duplicate "imported + LMS" listing the user
  // was seeing. Match on email OR last-10-digits of the mobile, since the
  // imported row may have only one of those.
  try {
    const emailMatch = String(rest.email || '').trim().toLowerCase();
    const phoneRaw = String(rest.whatsapp || rest.mobile || '');
    const phoneDigits = phoneRaw.replace(/\D/g, '');
    const last10 = phoneDigits.slice(-10);
    // Match conditions, narrowest-first to avoid suffix collisions across
    // countries:
    //   1. Email exact, normalised — strongest, never collides.
    //   2. Full-digit phone equality (handles imported rows that already
    //      stored the country-code prefix).
    //   3. Last-10 fallback ONLY when the imported row carries no email
    //      (typical "phone-only" case the user is trying to clean up) and
    //      the registrant supplied at least 10 digits — prevents random
    //      4-digit matches and won't sweep up an unrelated full-profile
    //      contact that happens to share a numeric tail.
    if (emailMatch || phoneDigits) {
      await sql`
        DELETE FROM marketing_participants
         WHERE (${emailMatch} <> '' AND lower(data->>'email') = ${emailMatch})
            OR (${phoneDigits} <> '' AND regexp_replace(coalesce(data->>'mobile',''), '\D', '', 'g') = ${phoneDigits})
            OR (
              ${last10} <> ''
              AND length(${last10}) = 10
              AND coalesce(data->>'email','') = ''
              AND right(regexp_replace(coalesce(data->>'mobile',''), '\D', '', 'g'), 10) = ${last10}
            )
      `;
    }
  } catch (e) {
    console.warn('training-register: marketing cleanup failed (non-fatal)', e);
  }

  // STRICT POLICY (per user request): a personal Refer & Earn coupon is
  // ONLY issued when the training-calendar session itself defines BOTH a
  // non-zero `couponDiscount` AND a non-zero `couponCommission`. If either
  // field is empty/zero the participant gets no coupon — no global-settings
  // fallback, no ₹1 floor. The same rule is mirrored in the payment-verify
  // PATCH handler and the admin backfill endpoint.
  const sessionCouponDiscount   = Number(sessionCalData?.couponDiscount)   || 0;
  const sessionCouponCommission = Number(sessionCalData?.couponCommission) || 0;
  let generatedCouponResult: { code: string; activeFrom: string; expiresAt: string; discount: number; commission: number } | null = null;
  if (sessionCouponDiscount > 0 && sessionCouponCommission > 0) {
    generatedCouponResult = await autoGenerateRegistrantCoupon(
      id,
      sessionId,
      sessionTitle || sessionCalData?.topic || '',
      sessionCalData?.date || '',
      rest.name || '',
      rest.email || '',
      rest.mobile || rest.whatsapp || '',
      sessionCouponDiscount,
      sessionCouponCommission,
    );
  }
  if (generatedCouponResult) {
    // Source amounts from the persisted coupon row so registration JSONB
    // stays consistent with what affiliate_coupons stored (matters when
    // autoGenerate returned a pre-existing coupon).
    const authDiscount   = Number(generatedCouponResult.discount)   || sessionCouponDiscount;
    const authCommission = Number(generatedCouponResult.commission) || sessionCouponCommission;
    const couponPatch = JSON.stringify({
      myCouponCode: generatedCouponResult.code,
      myCouponDiscount: authDiscount,
      myCouponCommission: authCommission,
      myCouponActiveFrom: generatedCouponResult.activeFrom,
      myCouponExpiresAt: generatedCouponResult.expiresAt,
      myCouponIssuedAt: new Date().toISOString(),
      myCouponIssuedBy: 'registration',
    });
    await sql`UPDATE training_registrations SET data = data || ${couponPatch}::jsonb WHERE id = ${id}`;
  }

  // Confirmation email/WhatsApp per participant
  const isPaid = !!(rest.utrNumber || rest.paymentStatus);
  const emailParams = {
    to:              rest.email,
    name:            rest.name,
    sessionTitle:    sessionTitle || sessionCalData?.topic || '',
    sessionDate:     sessionCalData?.date || sessionDate || '',
    sessionTime:     sessionCalData?.startTime
                      ? `${sessionCalData.startTime}${sessionCalData.endTime ? ' – ' + sessionCalData.endTime : ''}`
                      : '',
    sessionMode:     sessionCalData?.mode || '',
    sessionLocation: sessionCalData?.location || '',
    trainer:         sessionCalData?.trainer || '',
    // Resource links — surfaced as a "Stay Connected" footer in the email
    // so registrants get the WhatsApp group, the live meeting link, and our
    // socials in the very first message they receive from us.
    meetingLink:     sessionCalData?.meetingLink   || null,
    whatsappLink:    sessionCalData?.whatsappLink  || null,
    instagramLink:   sessionCalData?.instagramLink || null,
    linkedinLink:    sessionCalData?.linkedinLink  || null,
  };
  if (!isPaid) {
    const freeParams = {
      ...emailParams,
      myCouponCode:     generatedCouponResult?.code       || null,
      couponDiscount:   sessionCouponDiscount              || null,
      couponCommission: sessionCouponCommission            || null,
      couponActiveFrom: generatedCouponResult?.activeFrom  || null,
      couponExpiresAt:  generatedCouponResult?.expiresAt   || null,
      couponMaxUses:    5,
    };
    sendFreeRegistrationConfirmation(freeParams)
      .then(handleEmailResult(id, 'emailSentAt', 'free_registration_confirmation', rest.email, freeParams))
      .catch(() => null);
    sendWhatsAppFreeConfirmation({
      to:              rest.mobile || rest.whatsapp || '',
      name:            rest.name,
      sessionTitle:    emailParams.sessionTitle,
      sessionDate:     emailParams.sessionDate,
      sessionTime:     emailParams.sessionTime,
      sessionMode:     emailParams.sessionMode,
      myCouponCode:    generatedCouponResult?.code       || null,
      couponDiscount:  sessionCouponDiscount              || null,
      couponCommission: sessionCouponCommission           || null,
    }).then(ok => { if (ok) markNotificationSent(id, 'whatsappSentAt'); }).catch(() => null);
  } else {
    const paidParams = {
      ...emailParams,
      utrNumber:        rest.utrNumber ?? '',
      courseFee:        Number(sessionCalData?.fee) || undefined,
      couponDiscount:   sessionCouponDiscount  || null,
      couponCommission: sessionCouponCommission || null,
      couponMaxUses:    5,
    };
    sendPaidRegistrationPending(paidParams)
      .then(handleEmailResult(id, 'emailSentAt', 'paid_registration_pending', rest.email, paidParams))
      .catch(() => null);
    sendWhatsAppPaymentPending({
      to:           rest.mobile || rest.whatsapp || '',
      name:         rest.name,
      sessionTitle: emailParams.sessionTitle,
      utrNumber:    rest.utrNumber ?? '',
    }).then(ok => { if (ok) markNotificationSent(id, 'whatsappSentAt'); }).catch(() => null);
  }

  // ── Auto-send meeting link (free path only) ───────────────────────────────
  // Per-event toggle. Defaults ON. The pre-flight gate at the top of POST
  // already blocked the request if the toggle is ON and the link is missing,
  // so reaching this branch with isPaid=false guarantees a usable link.
  if (!isPaid) {
    try {
      const auto = readAutoSendSettings(sessionCalData);
      const link = String(sessionCalData?.meetingLink || '').trim();
      if (auto.onFreeRegister && link && /^https?:\/\/\S+$/i.test(link)) {
        const dispatch = dispatchMeetingLinkAutoSend({
          channels:      auto.channels,
          to_email:      rest.email,
          to_phone:      rest.mobile || rest.whatsapp || null,
          name:          rest.name,
          sessionTitle:  emailParams.sessionTitle,
          sessionDate:   emailParams.sessionDate,
          sessionTime:   emailParams.sessionTime,
          trainer:       sessionCalData?.trainer || null,
          meetingLink:   link,
          sessionId,
          registrantId:  id,
          whatsappLink:  sessionCalData?.whatsappLink  || null,
          instagramLink: sessionCalData?.instagramLink || null,
          linkedinLink:  sessionCalData?.linkedinLink  || null,
        });
        // Stamp the registrant row when the dispatch reports success per
        // channel so the broadcast UI shows "already sent" badges on the
        // next manual send.
        dispatch.then(r => {
          const patch: Record<string, string> = {};
          if (r.emailOk) { patch.meetingLinkEmailSentAt    = new Date().toISOString(); patch.meetingLinkEmailLast    = link; }
          if (r.waOk)    { patch.meetingLinkWhatsAppSentAt = new Date().toISOString(); patch.meetingLinkWhatsAppLast = link; }
          if (Object.keys(patch).length === 0) return;
          const p = JSON.stringify(patch);
          sql`UPDATE training_registrations SET data = data || ${p}::jsonb WHERE id = ${id}`.catch(() => null);
        }).catch(() => null);
      }
    } catch (e) {
      console.warn('[training-register POST] auto-send meeting link failed', e);
    }
  }

  return { id, data, generatedCoupon: generatedCouponResult };
}

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const body = await request.json();
    const { sessionId, sessionTitle, sessionDate, couponCode, couponDiscount, couponOwnerId, participants: participantsArr, ...rest } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // ── Normalise to a list of participants ──────────────────────────────────
    // Backwards compatible: if no `participants` array, wrap the legacy
    // single-payload shape into a one-element list.
    type RegPayload = Record<string, unknown>;
    let participants: RegPayload[] = [];
    const sharedFields: RegPayload = {};
    const paymentFields: RegPayload = {};
    if (Array.isArray(participantsArr) && participantsArr.length > 0) {
      // Pull shared (common) fields off the top-level body.
      for (const k of SHARED_PARTICIPANT_FIELDS) {
        if (rest[k] !== undefined) sharedFields[k] = rest[k];
      }
      // Payment / proof fields are shared across the batch.
      for (const k of ['paymentScreenshot', 'utrNumber', 'paymentStatus']) {
        if (rest[k] !== undefined) paymentFields[k] = rest[k];
      }
      participants = (participantsArr as RegPayload[]).map(p => ({ ...p }));
    } else {
      // Legacy: whole body (minus session/coupon) IS the single participant.
      participants = [{ ...rest }];
    }

    if (participants.length === 0) {
      return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 });
    }
    if (participants.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 participants per submission.' }, { status: 400 });
    }

    // ── Per-participant validation ───────────────────────────────────────────
    // Helpers used by the duplicate-registration guard below.
    const normEmail  = (v: any) => String(v || '').trim().toLowerCase();
    const normMobile = (v: any) => String(v || '').replace(/\D/g, '').slice(-10);

    // Track within-batch duplicates so a single submission can't sneak two
    // participants past the DB check by sharing email/mobile.
    const batchEmails  = new Set<string>();
    const batchMobiles = new Set<string>();

    for (let i = 0; i < participants.length; i++) {
      const p = { ...sharedFields, ...participants[i] };
      const label = participants.length > 1 ? ` for participant #${i + 1}` : '';
      if (!p.name || !String(p.name).trim()) {
        return NextResponse.json({ error: `Full name is required${label}.` }, { status: 400 });
      }
      if (!p.email || !String(p.email).trim()) {
        return NextResponse.json({ error: `Email is required${label}.` }, { status: 400 });
      }
      // Prefer the first non-empty value: an empty `whatsapp` field on the
      // payload should not shadow a populated `mobile`, otherwise the
      // dup-check below would silently skip the mobile comparison.
      const waVal     = typeof p.whatsapp === 'string' ? p.whatsapp.trim() : '';
      const mobileVal = typeof p.mobile   === 'string' ? p.mobile.trim()   : '';
      const submittedPhone = waVal || mobileVal;
      if (submittedPhone.trim()) {
        const waCheck = resolveWaContact(submittedPhone, { country: typeof p.country === 'string' ? p.country : null });
        if (waCheck.url === null || waCheck.invalid === true) {
          return NextResponse.json(
            { error: `That mobile number doesn't match any recognised country format${label}. Please include the country code (e.g. +91 98765 43210).` },
            { status: 400 }
          );
        }
      }

      // ── Duplicate-registration guard (per training session) ──────────────
      // Per user spec: within a single training, the same email or the same
      // mobile (or both) can only register once. Prevents accidental
      // double-bookings + bot/refresh re-submits. Checks both within the
      // current batch and against existing rows already in the DB.
      const emailKey  = normEmail(p.email);
      const mobileKey = normMobile(submittedPhone);

      if (emailKey && batchEmails.has(emailKey)) {
        return NextResponse.json(
          { error: `Duplicate email in this submission${label}: ${p.email}. Each participant must have a unique email.` },
          { status: 400 }
        );
      }
      if (mobileKey && batchMobiles.has(mobileKey)) {
        return NextResponse.json(
          { error: `Duplicate mobile number in this submission${label}: ${submittedPhone}. Each participant must have a unique mobile.` },
          { status: 400 }
        );
      }
      if (emailKey)  batchEmails.add(emailKey);
      if (mobileKey) batchMobiles.add(mobileKey);

      try {
        let existing: any[] = [];
        if (emailKey && mobileKey) {
          // NOTE: use `nullif(..., '')` inside coalesce — without it, an
          // empty-string `mobile` would shadow a populated `whatsapp` and
          // the comparison would never match real DB duplicates.
          const r: any = await sql`
            SELECT id, data FROM training_registrations
            WHERE session_id = ${sessionId}
              AND (
                lower(data->>'email') = ${emailKey}
                OR right(regexp_replace(coalesce(nullif(data->>'mobile',''), nullif(data->>'whatsapp',''), ''), '\D', '', 'g'), 10) = ${mobileKey}
              )
            LIMIT 1
          `;
          existing = Array.isArray(r) ? r : [];
        } else if (emailKey) {
          const r: any = await sql`
            SELECT id FROM training_registrations
            WHERE session_id = ${sessionId} AND lower(data->>'email') = ${emailKey}
            LIMIT 1
          `;
          existing = Array.isArray(r) ? r : [];
        } else if (mobileKey) {
          const r: any = await sql`
            SELECT id FROM training_registrations
            WHERE session_id = ${sessionId}
              AND right(regexp_replace(coalesce(nullif(data->>'mobile',''), nullif(data->>'whatsapp',''), ''), '\D', '', 'g'), 10) = ${mobileKey}
            LIMIT 1
          `;
          existing = Array.isArray(r) ? r : [];
        }
        if (existing.length > 0) {
          return NextResponse.json(
            { error: `This person is already registered for this training${label}. Each email and mobile can only register once per training session.` },
            { status: 409 }
          );
        }
      } catch (err) {
        // Don't fail the registration if the dup-check query itself errored
        // (e.g. transient DB issue) — log and proceed so genuine first-time
        // registrations aren't blocked by infrastructure hiccups.
        console.warn('training-register: duplicate-check query failed (non-fatal)', err);
      }
    }

    // ── UTR de-dup (single payment per batch) ────────────────────────────────
    const utrSource = paymentFields.utrNumber ?? participants[0]?.utrNumber ?? rest.utrNumber;
    if (utrSource && typeof utrSource === 'string' && utrSource.trim().length >= 8) {
      const utrUpper = utrSource.trim().toUpperCase();
      try {
        const dupCheck = await sql`SELECT id FROM training_registrations WHERE data->>'utrNumber' = ${utrUpper} LIMIT 1`;
        const dupRows = Array.isArray(dupCheck) ? dupCheck : [];
        if (dupRows.length > 0) {
          return NextResponse.json({ error: 'This UTR number has already been used for another registration. Please check and re-enter.' }, { status: 400 });
        }
      } catch {}
      paymentFields.utrNumber = utrUpper;
    }
    if (paymentFields.paymentScreenshot && !paymentFields.paymentStatus) {
      paymentFields.paymentStatus = 'pending';
    }

    // Look up calendar session ONCE for shared metadata.
    let sessionCalData: any = null;
    try {
      const calRes = await sql`SELECT id, data FROM training_calendar WHERE id = ${sessionId} LIMIT 1`;
      const calRows = Array.isArray(calRes) ? calRes : [];
      if (calRows.length > 0) sessionCalData = calRows[0].data;
    } catch {}

    // ── Auto-send meeting-link pre-flight gate (free path) ─────────────────
    // If the per-event toggle "On free registration" is ON and no usable
    // meeting link is configured, block the registration with a clear
    // participant-facing error. This prevents accepting registrants for
    // an event whose joining link is missing/broken.
    {
      const autoSettings = readAutoSendSettings(sessionCalData);
      const isFreeBatch = !paymentFields.paymentStatus
        && !(typeof utrSource === 'string' && utrSource.trim().length >= 8);
      if (autoSettings.onFreeRegister && isFreeBatch) {
        const linkErr = assertMeetingLinkOrError(sessionCalData?.meetingLink);
        if (linkErr) {
          return NextResponse.json({
            error: 'Registration is temporarily unavailable: ' + linkErr + ' Please contact the organiser.',
          }, { status: 409 });
        }
      }
    }

    const isBatch = participants.length > 1;
    const batchId = isBatch ? `batch-${Date.now()}-${crypto.randomBytes(3).toString('hex')}` : undefined;
    const sharedForRow = { ...sharedFields, ...paymentFields };

    const processed: ProcessedParticipant[] = [];
    for (let i = 0; i < participants.length; i++) {
      const result = await processOneParticipant({
        sessionId,
        sessionTitle,
        sessionDate,
        participant: participants[i],
        shared: sharedForRow,
        couponCode,
        couponDiscount,
        couponOwnerId,
        batchId,
        batchIndex: isBatch ? i + 1 : undefined,
        batchSize: isBatch ? participants.length : undefined,
        sessionCalData,
      });
      processed.push(result);
    }

    const first = processed[0];
    return NextResponse.json({
      success: true,
      id: first.id,
      ids: processed.map(p => p.id),
      batchId: batchId || null,
      batchSize: processed.length,
      participants: processed.map(p => ({
        id: p.id,
        name: p.data.name,
        email: p.data.email,
        myCouponCode: p.generatedCoupon?.code || null,
      })),
      myCouponCode:       first.generatedCoupon?.code       || null,
      myCouponCommission: Number(sessionCalData?.couponCommission) || null,
      myCouponDiscount:   Number(sessionCalData?.couponDiscount)   || null,
      myCouponActiveFrom: first.generatedCoupon?.activeFrom  || null,
      myCouponExpiresAt:  first.generatedCoupon?.expiresAt   || null,
    });
  } catch (error) {
    console.error('training-register POST error:', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureTables();
    const body = await request.json();
    const { id, attendanceStatus, couponCode, couponDiscount, couponOwnerId, paymentStatus, whatsapp, mobile, markGroupLinkSent, groupLinkSentBy } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const patchFields: Record<string, any> = {};
    if (attendanceStatus) patchFields.attendanceStatus = attendanceStatus;
    if (couponCode)       patchFields.couponCode       = couponCode;
    if (couponDiscount !== undefined) patchFields.couponDiscount = couponDiscount;
    if (couponOwnerId)    patchFields.couponOwnerId    = couponOwnerId;
    if (paymentStatus && ['pending', 'verified', 'rejected'].includes(paymentStatus)) {
      patchFields.paymentStatus = paymentStatus;
      patchFields.paymentVerifiedAt = new Date().toISOString();
    }

    // ── Auto-send meeting-link pre-flight gate (verify path) ──────────────
    // If the admin is verifying a payment AND the per-event toggle
    // "On payment verify" is ON AND no usable meeting link is configured,
    // BLOCK verify with a clear admin-facing error. Fail-closed: if the
    // calendar lookup itself errors we also block, since silently letting
    // verify through could deliver a confirmed seat with no joining link.
    if (paymentStatus === 'verified') {
      let preflightCalData: any = null;
      try {
        const calRes = await sql`
          SELECT t.data
          FROM   training_registrations r
          JOIN   training_calendar      t ON t.id = r.session_id
          WHERE  r.id = ${id}
          LIMIT  1
        `;
        const calRows = Array.isArray(calRes) ? calRes : [];
        preflightCalData = calRows.length > 0 ? calRows[0].data : null;
      } catch (e) {
        console.error('[training-register PATCH] verify-gate lookup failed', e);
        return NextResponse.json({
          error: 'Cannot verify payment right now — failed to read the event configuration. Please retry in a moment.',
        }, { status: 503 });
      }
      const autoSettings = readAutoSendSettings(preflightCalData);
      if (autoSettings.onVerify) {
        const linkErr = assertMeetingLinkOrError(preflightCalData?.meetingLink);
        if (linkErr) {
          return NextResponse.json({
            error: 'Cannot verify payment — ' + linkErr + ' (Or turn off "Auto-send meeting link on payment verify" in the event settings.)',
          }, { status: 409 });
        }
      }
    }
    if (typeof whatsapp === 'string') patchFields.whatsapp = whatsapp.trim();
    if (typeof mobile   === 'string') patchFields.mobile   = mobile.trim();
    // Idempotent "group link broadcast" marker. Front-end fires this PATCH
    // right after it pops the wa.me chat for a registrant so admins can see
    // who has already been messaged and skip them on the next broadcast.
    // Read-then-write keeps the original "first sent" timestamp stable on
    // re-fires so this PATCH is truly idempotent for the same registrant.
    let groupLinkAlreadySent = false;
    if (markGroupLinkSent === true) {
      try {
        const existingRes = await sql`SELECT data FROM training_registrations WHERE id = ${id} LIMIT 1`;
        const rows = Array.isArray(existingRes) ? existingRes : [];
        const existing = rows[0]?.data || {};
        groupLinkAlreadySent = !!existing.groupLinkSentAt;
      } catch { /* fall through and set */ }
      if (!groupLinkAlreadySent) {
        patchFields.groupLinkSentAt = new Date().toISOString();
        if (typeof groupLinkSentBy === 'string' && groupLinkSentBy.trim()) {
          patchFields.groupLinkSentBy = groupLinkSentBy.trim().slice(0, 120);
        }
      }
    }
    if (Object.keys(patchFields).length === 0) {
      // Idempotent re-fire of markGroupLinkSent on an already-marked
      // registrant: respond OK with noOp so callers don't treat retries
      // (or parallel broadcasts) as failures.
      if (markGroupLinkSent === true && groupLinkAlreadySent) {
        return NextResponse.json({ success: true, noOp: true });
      }
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    const patch = JSON.stringify(patchFields);
    await sql`UPDATE training_registrations SET data = data || ${patch}::jsonb WHERE id = ${id}`;

    // ── Post-verification: coupon credit + owner email + registrant email ─────
    if (paymentStatus === 'verified') {
      try {
        const regResult = await sql`SELECT data, session_id FROM training_registrations WHERE id = ${id} LIMIT 1`;
        const regRows = Array.isArray(regResult) ? regResult : [];
        if (regRows.length > 0) {
          let reg = regRows[0].data || {};
          const sessionId = regRows[0].session_id;
          let calData: any = null;
          try {
            const calRes = await sql`SELECT data FROM training_calendar WHERE id = ${sessionId} LIMIT 1`;
            const calRows = Array.isArray(calRes) ? calRes : [];
            if (calRows.length > 0) calData = calRows[0].data;
          } catch {}

          if (!reg.myCouponCode) {
            // STRICT POLICY (per user request): only auto-issue a coupon
            // here when the session itself has BOTH couponDiscount > 0 AND
            // couponCommission > 0. If the trainer left those blank on the
            // training calendar, no coupon is created — same rule as the
            // registration POST handler and the admin backfill endpoint.
            try {
              const resolvedDiscount   = Number(calData?.couponDiscount)   || 0;
              const resolvedCommission = Number(calData?.couponCommission) || 0;
              const generated = (resolvedDiscount > 0 && resolvedCommission > 0)
                ? await autoGenerateRegistrantCoupon(
                    id,
                    sessionId,
                    reg.sessionTitle || calData?.topic || '',
                    calData?.date || reg.sessionDate || '',
                    reg.name || '',
                    reg.email || '',
                    reg.mobile || reg.whatsapp || '',
                    resolvedDiscount,
                    resolvedCommission,
                  )
                : null;
              if (generated) {
                // Source amounts from the persisted coupon row so the
                // registration JSONB / email fields can never diverge
                // from what affiliate_coupons stored (matters when
                // autoGenerate returned a pre-existing coupon).
                const authDiscount   = Number(generated.discount)   || resolvedDiscount;
                const authCommission = Number(generated.commission) || resolvedCommission;
                const couponPatch = JSON.stringify({
                  myCouponCode: generated.code,
                  myCouponDiscount: authDiscount,
                  myCouponCommission: authCommission,
                  myCouponActiveFrom: generated.activeFrom,
                  myCouponExpiresAt: generated.expiresAt,
                  myCouponIssuedAt: new Date().toISOString(),
                  myCouponIssuedBy: 'payment-verified',
                });
                // CAS update: only write if myCouponCode is still empty.
                await sql`
                  UPDATE training_registrations
                  SET data = data || ${couponPatch}::jsonb
                  WHERE id = ${id}
                    AND (data->>'myCouponCode' IS NULL OR data->>'myCouponCode' = '')
                `;
                // Re-read so we use whichever coupon ultimately won.
                try {
                  const finalRes = await sql`SELECT data FROM training_registrations WHERE id = ${id} LIMIT 1`;
                  const finalRows = Array.isArray(finalRes) ? finalRes : [];
                  if (finalRows.length > 0) reg = finalRows[0].data || reg;
                } catch {
                  // Fall back to the just-generated values in memory.
                  reg = {
                    ...reg,
                    myCouponCode: generated.code,
                    myCouponDiscount: authDiscount,
                    myCouponCommission: authCommission,
                    myCouponActiveFrom: generated.activeFrom,
                    myCouponExpiresAt: generated.expiresAt,
                  };
                }
              }
            } catch (err) {
              console.error('payment-verify: failed to auto-issue coupon', err);
            }
          }

          // Credit the coupon owner (only if coupon was applied)
          if (reg.couponCode) {
            processTrainingAffiliateCredit(
              String(reg.couponCode),
              sessionId,
              reg.sessionTitle || calData?.topic || '',
              Number(calData?.courseFee) || 0,
              reg.name || '',
              id,
              reg.email || '',
            ).then(creditResult => {
              if (creditResult) {
                if (creditResult.ownerEmail) {
                  const couponParams = {
                    to: creditResult.ownerEmail,
                    ownerName: creditResult.ownerName,
                    usedByName: reg.name || 'A new registrant',
                    sessionTitle: reg.sessionTitle || calData?.topic || '',
                    amountEarned: creditResult.amountEarned,
                    totalEarned: creditResult.totalEarned,
                    usesRemaining: creditResult.usesRemaining,
                    maxUses: creditResult.maxUses,
                  };
                  sendCouponEarnedNotification(couponParams)
                    .then(handleEmailResult(id, 'couponEarnedEmailSentAt', 'coupon_earned', creditResult.ownerEmail, couponParams))
                    .catch(() => {});
                }
                if (creditResult.ownerPhone) {
                  sendWhatsAppCouponEarned({
                    to:            creditResult.ownerPhone,
                    ownerName:     creditResult.ownerName,
                    usedByName:    reg.name || 'A new registrant',
                    sessionTitle:  reg.sessionTitle || calData?.topic || '',
                    amountEarned:  creditResult.amountEarned,
                    usesRemaining: creditResult.usesRemaining,
                  }).catch(() => {});
                }
              }
            }).catch(() => {});
          }

          const verifiedParams = {
            to:              reg.email || '',
            name:            reg.name  || '',
            sessionTitle:    reg.sessionTitle || calData?.topic || '',
            sessionDate:     calData?.date || reg.sessionDate || '',
            sessionTime:     calData?.startTime
                              ? `${calData.startTime}${calData.endTime ? ' – ' + calData.endTime : ''}`
                              : '',
            sessionMode:     calData?.mode || '',
            sessionLocation: calData?.location || '',
            trainer:         calData?.trainer || '',
            meetingLink:     calData?.meetingLink   || null,
            whatsappLink:    calData?.whatsappLink  || null,
            instagramLink:   calData?.instagramLink || null,
            linkedinLink:    calData?.linkedinLink  || null,
            myCouponCode:     reg.myCouponCode     || null,
            couponDiscount:   reg.myCouponDiscount  || null,
            couponCommission: reg.myCouponCommission || null,
            couponActiveFrom: reg.myCouponActiveFrom || null,
            couponExpiresAt:  reg.myCouponExpiresAt  || null,
            couponMaxUses:    5,
          };
          // When auto-send-on-verify is active the dedicated meeting-link
          // send below is the canonical delivery for the joining link, so
          // suppress the duplicated link content in the confirmation email.
          // This honours the admin's per-event channel choice (email-only,
          // whatsapp-only, or both) instead of always emailing the link.
          const verifyAutoOn = readAutoSendSettings(calData).onVerify
            && !!String(calData?.meetingLink || '').trim();
          sendPaymentVerifiedEmail({ ...verifiedParams, suppressMeetingLink: verifyAutoOn })
            .then(handleEmailResult(id, 'verificationEmailSentAt', 'payment_verified', reg.email || '', verifiedParams))
            .catch(() => null);

          // Auto-send the joining link on verify per the event's toggle.
          // The pre-flight gate at the top of PATCH already guaranteed a
          // usable link when this branch runs.
          try {
            const auto = readAutoSendSettings(calData);
            const link = String(calData?.meetingLink || '').trim();
            if (auto.onVerify && link && /^https?:\/\/\S+$/i.test(link)) {
              dispatchMeetingLinkAutoSend({
                channels:      auto.channels,
                to_email:      reg.email  || null,
                to_phone:      reg.mobile || reg.whatsapp || null,
                name:          reg.name   || 'Participant',
                sessionTitle:  verifiedParams.sessionTitle,
                sessionDate:   verifiedParams.sessionDate,
                sessionTime:   verifiedParams.sessionTime,
                trainer:       calData?.trainer || null,
                meetingLink:   link,
                sessionId,
                registrantId:  id,
                whatsappLink:  calData?.whatsappLink  || null,
                instagramLink: calData?.instagramLink || null,
                linkedinLink:  calData?.linkedinLink  || null,
              }).then(r => {
                const patch: Record<string, string> = {};
                if (r.emailOk) { patch.meetingLinkEmailSentAt    = new Date().toISOString(); patch.meetingLinkEmailLast    = link; }
                if (r.waOk)    { patch.meetingLinkWhatsAppSentAt = new Date().toISOString(); patch.meetingLinkWhatsAppLast = link; }
                if (Object.keys(patch).length === 0) return;
                const p = JSON.stringify(patch);
                sql`UPDATE training_registrations SET data = data || ${p}::jsonb WHERE id = ${id}`.catch(() => null);
              }).catch(() => null);
            }
          } catch (e) {
            console.warn('[training-register PATCH] verify auto-send failed', e);
          }

          // Build the {{3}} training details block in the SAME card style
          // used by the bulk multi-training WhatsApp message
          // (buildTrainingsList in components/LmsAdmin.tsx): bold topic
          // on line 1, indented date+time row, indented trainer row.
          //
          // A registrant can have MULTIPLE active enrolments (they may
          // book several upcoming sessions across registrations). To
          // mirror the bulk-template behaviour, gather every training
          // this person is registered for that hasn't been rejected, dedupe
          // by session, sort by date, then render one card per training.
          // Falls back to the just-verified row if no other enrolments
          // are found.
          const fmtRegDate = (d: string) => {
            try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
            catch { return d; }
          };
          const renderCard = (topic: string, date: string, startTime: string, endTime: string, trainer: string): string => {
            const lines: string[] = [`✅ *${topic || 'Training'}*`];
            const meta: string[] = [];
            if (date) meta.push(`📅 ${fmtRegDate(date)}`);
            const time = startTime ? `${startTime}${endTime ? ' – ' + endTime : ''}` : '';
            if (time) meta.push(`🕒 ${time}`);
            if (meta.length) lines.push(`   ${meta.join('   ')}`);
            if (trainer) lines.push(`   👤 ${trainer}`);
            return lines.join('\n');
          };

          // Collect every active (non-rejected) registration for this
          // person, identified by email or mobile. Both lookups are
          // narrow indexed JSON probes so this stays cheap.
          const personEmail  = String(reg.email || '').trim().toLowerCase();
          const personMobile = String(reg.mobile || reg.whatsapp || '').replace(/\D/g, '');
          let mineRows: any[] = [];
          try {
            const r = await sql`
              SELECT session_id, data FROM training_registrations
              WHERE
                ( ${personEmail}  <> '' AND lower(data->>'email') = ${personEmail} )
                OR
                ( ${personMobile} <> '' AND regexp_replace(coalesce(data->>'mobile',''), '\D', '', 'g') = ${personMobile} )
                OR
                ( ${personMobile} <> '' AND regexp_replace(coalesce(data->>'whatsapp',''), '\D', '', 'g') = ${personMobile} )
              LIMIT 50
            `;
            mineRows = Array.isArray(r) ? r : [];
          } catch {}

          // Dedupe by sessionId, drop rejected payments, hydrate session
          // info from training_calendar (fall back to the row's own data
          // for legacy registrations missing a calendar link).
          const seenSessionIds = new Set<string>();
          type Card = { date: string; topic: string; startTime: string; endTime: string; trainer: string };
          const cards: Card[] = [];
          for (const row of mineRows) {
            const rData = row.data || {};
            if (rData.paymentStatus === 'rejected') continue;
            const sId = String(row.session_id || rData.sessionId || '');
            if (sId && seenSessionIds.has(sId)) continue;
            if (sId) seenSessionIds.add(sId);
            let cData: any = null;
            if (sId) {
              try {
                const cRes = await sql`SELECT data FROM training_calendar WHERE id = ${sId} LIMIT 1`;
                const cRows = Array.isArray(cRes) ? cRes : [];
                if (cRows.length > 0) cData = cRows[0].data;
              } catch {}
            }
            cards.push({
              date:      cData?.date      || rData.sessionDate || '',
              topic:     rData.sessionTitle || cData?.topic     || 'Training',
              startTime: cData?.startTime || '',
              endTime:   cData?.endTime   || '',
              trainer:   cData?.trainer   || '',
            });
          }

          // Sort upcoming first; missing dates sink to the bottom.
          cards.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return a.date.localeCompare(b.date);
          });

          // Always include at least the just-verified training as a
          // safety net (e.g. if the cross-registration lookup found
          // nothing because of a typo / unsynced row).
          if (cards.length === 0) {
            cards.push({
              date:      calData?.date      || reg.sessionDate || '',
              topic:     reg.sessionTitle   || calData?.topic   || 'Training',
              startTime: calData?.startTime || '',
              endTime:   calData?.endTime   || '',
              trainer:   calData?.trainer   || '',
            });
          }

          const trainingDetails = cards
            .map(c => renderCard(c.topic, c.date, c.startTime, c.endTime, c.trainer))
            .join('\n\n');

          sendWhatsAppTrainingReferralConfirmed({
            to:              reg.mobile || reg.whatsapp || '',
            name:            reg.name || '',
            referralCode:    reg.myCouponCode || null,
            trainingDetails,
          }).then(ok => { if (ok) markNotificationSent(id, 'verificationWaSentAt'); }).catch(() => null);
        }
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('training-register PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
  }
}
