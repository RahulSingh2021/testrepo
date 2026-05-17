// Background retry for transient email failures on training registrations.
//
// Tracks per-field attempt count, exponential backoff, and a "give up"
// marker so the admin UI can distinguish a still-retrying failure from a
// permanently failed one.

import sql from './db';
import {
  sendFreeRegistrationConfirmation,
  sendPaidRegistrationPending,
  sendPaymentVerifiedEmail,
  sendCouponEarnedNotification,
  type SendEmailResult,
} from './sendEmail';

export const RETRY_FIELDS = [
  'emailSentAt',
  'verificationEmailSentAt',
  'couponEarnedEmailSentAt',
] as const;
export type RetryField = typeof RETRY_FIELDS[number];

const MAX_ATTEMPTS = 5;
// Exponential-ish backoff in minutes for attempts 1..5
const BACKOFF_MINUTES = [15, 30, 60, 120, 240];

function nextRetryAtFor(attempts: number): string {
  const idx = Math.max(0, Math.min(attempts - 1, BACKOFF_MINUTES.length - 1));
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000).toISOString();
}

async function dispatchSend(template: string, payload: any): Promise<SendEmailResult> {
  switch (template) {
    case 'free_registration_confirmation': return sendFreeRegistrationConfirmation(payload);
    case 'paid_registration_pending':       return sendPaidRegistrationPending(payload);
    case 'payment_verified':                 return sendPaymentVerifiedEmail(payload);
    case 'coupon_earned':                    return sendCouponEarnedNotification(payload);
    default:
      return { ok: false, error: { message: `Unknown template: ${template}` } };
  }
}

async function markRetrySuccess(id: string, field: RetryField) {
  const now = new Date().toISOString();
  const patch = JSON.stringify({
    [field]: now,
    [`${field}FailedAt`]: null,
    [`${field}Error`]: null,
    [`${field}NextRetryAt`]: null,
    [`${field}GiveUpAt`]: null,
  });
  await sql`UPDATE training_registrations SET data = data || ${patch}::jsonb WHERE id = ${id}`;
}

async function markRetryFailure(
  id: string,
  field: RetryField,
  attempts: number,
  template: string,
  recipient: string,
  error: { code?: string; responseCode?: number; message: string } | undefined,
) {
  const now = new Date().toISOString();
  const giveUp = attempts >= MAX_ATTEMPTS;
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
    [`${field}NextRetryAt`]: giveUp ? null : nextRetryAtFor(attempts),
  };
  if (giveUp) patch[`${field}GiveUpAt`] = now;
  await sql`UPDATE training_registrations SET data = data || ${JSON.stringify(patch)}::jsonb WHERE id = ${id}`;
}

export async function retryRegistrationField(
  id: string,
  field: RetryField,
  opts: { manual?: boolean } = {},
): Promise<{ ok: boolean; error?: string; attempts?: number; gaveUp?: boolean }> {
  let rows: any[] = [];
  try {
    const safeId = id.replace(/'/g, "''");
    const r = await sql.unsafe(`SELECT id, data FROM training_registrations WHERE id = '${safeId}' LIMIT 1`);
    rows = Array.isArray(r) ? r : (r as any)?.rows || [];
  } catch (err: any) {
    console.error(`[Retry] lookup failed id=${id} field=${field} err=${err?.message}`);
    return { ok: false, error: 'lookup failed: ' + (err?.message || 'unknown') };
  }
  if (rows.length === 0) return { ok: false, error: 'registration not found' };

  const data = rows[0].data || {};
  const template = data[`${field}RetryTemplate`];
  const payload  = data[`${field}RetryPayload`];

  if (!template || !payload) {
    return { ok: false, error: 'no retry payload stored — original send context missing' };
  }
  if (data[field]) return { ok: true, error: 'already sent' };
  if (!opts.manual && data[`${field}GiveUpAt`]) {
    return { ok: false, error: 'given up — manual resend required' };
  }

  // Manual resends reset the give-up state and start fresh-ish (still increment).
  const prevAttempts = Number(data[`${field}Attempts`]) || 0;
  const attempts = (opts.manual && data[`${field}GiveUpAt`]) ? 1 : prevAttempts + 1;

  const result = await dispatchSend(template, payload);
  if (result.ok) {
    await markRetrySuccess(id, field);
    console.log(`[Retry] SUCCESS id=${id} field=${field} template=${template} attempts=${attempts}${opts.manual ? ' (manual)' : ''}`);
    return { ok: true, attempts };
  }
  await markRetryFailure(id, field, attempts, template, String(data[`${field}RetryRecipient`] || ''), result.error);
  const gaveUp = attempts >= MAX_ATTEMPTS;
  console.warn(`[Retry] FAILED id=${id} field=${field} template=${template} attempts=${attempts} giveUp=${gaveUp} error=${result.error?.message}`);
  return { ok: false, error: result.error?.message || 'send failed', attempts, gaveUp };
}

export async function retryFailedEmails(): Promise<{ scanned: number; retried: number; succeeded: number; failed: number }> {
  const stats = { scanned: 0, retried: 0, succeeded: 0, failed: 0 };
  const nowIso = new Date().toISOString();
  for (const field of RETRY_FIELDS) {
    let rows: any[] = [];
    try {
      const r = await sql.unsafe(
        `SELECT id FROM training_registrations
         WHERE (data->>'${field}FailedAt') IS NOT NULL
           AND (data->>'${field}') IS NULL
           AND (data->>'${field}GiveUpAt') IS NULL
           AND (data->>'${field}NextRetryAt') IS NOT NULL
           AND (data->>'${field}NextRetryAt') <= '${nowIso}'
           AND (data->>'${field}RetryTemplate') IS NOT NULL
         LIMIT 100`
      );
      rows = Array.isArray(r) ? r : (r as any)?.rows || [];
    } catch (err) {
      console.error(`[Retry] scan failed field=${field}`, err);
      continue;
    }
    stats.scanned += rows.length;
    for (const row of rows) {
      stats.retried++;
      const res = await retryRegistrationField(row.id, field);
      if (res.ok) stats.succeeded++; else stats.failed++;
    }
  }
  return stats;
}

let schedulerStarted = false;
const RETRY_INTERVAL_MS = 15 * 60 * 1000;

export function startEmailRetryScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log('[Retry] Email retry scheduler started — scan every 15 min');
  // Stagger first run so it doesn't fight server boot
  setTimeout(() => {
    retryFailedEmails()
      .then(s => { if (s.scanned > 0) console.log('[Retry] First scan:', s); })
      .catch(err => console.error('[Retry] First scan error:', err));
    setInterval(() => {
      retryFailedEmails()
        .then(s => { if (s.scanned > 0) console.log('[Retry] Scan:', s); })
        .catch(err => console.error('[Retry] Scan error:', err));
    }, RETRY_INTERVAL_MS);
  }, 60_000);
}
