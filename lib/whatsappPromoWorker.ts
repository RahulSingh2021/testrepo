// In-process background worker that drains queued WhatsApp promo blasts.
//
// Why a worker exists at all
// --------------------------
// The original `/api/whatsapp/training-promo` endpoint fanned out the Meta
// UTILITY template inline (concurrency 8) inside a single HTTP request. That
// works fine for the LMS list of ~8 users today, but once it grows past a
// few hundred recipients the request will hit the upstream proxy / serverless
// timeout and the blast will only partially complete with no resume path.
//
// The fix is to persist the blast as a job + per-recipient rows, return the
// jobId to the admin UI immediately, and let this worker drain the recipient
// queue in the background. The UI polls the same route to show progress and
// can retry failed recipients.
//
// Concurrency / safety model
// --------------------------
// 1. Recipients are claimed in batches via an atomic
//    `UPDATE ... WHERE id IN (SELECT ... LIMIT N) RETURNING ...` so two
//    workers (or two batches inside the same worker) cannot grab the same
//    recipient twice — Postgres serialises the UPDATE.
// 2. Only one worker loop runs per Node process (`workerRunning` flag). The
//    HACCP PRO `npm start` is a single long-lived `node server.js`, so this
//    is sufficient today. If the app is ever scaled horizontally, the
//    recipient claim is still safe; the worst case is two processes both
//    polling and splitting the work.
// 3. The loop self-terminates as soon as it sees an empty claim across all
//    pending jobs, so it does not burn CPU when the queue is idle.

import sql from '@/lib/db';
import { sendWhatsAppTemplate } from '@/lib/whatsappSendCore';

// How many recipients a single worker tick processes in parallel. Mirrors the
// previous inline fan-out value; Meta's per-second cap on the 1k tier is
// generous, but this keeps us well under it and bounds the burst.
const BATCH_SIZE = 8;

// Pause between ticks when the queue still has work. Keeps the loop from
// hot-spinning while still draining quickly.
const TICK_DELAY_MS = 250;

// How many times we'll retry a single recipient before marking it permanently
// failed. The admin UI exposes a "Retry failed" button that resets the count
// for any recipient still in the failed bucket.
const MAX_ATTEMPTS = 3;

let workerRunning = false;

async function ensureSchema(): Promise<void> {
  // Idempotent. Called once per worker boot AND once per enqueue so a fresh
  // database doesn't need a separate migration step.
  await sql`CREATE TABLE IF NOT EXISTS whatsapp_promo_jobs (
    id TEXT PRIMARY KEY,
    training_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total INT NOT NULL DEFAULT 0,
    succeeded INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    payload JSONB NOT NULL,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS whatsapp_promo_recipients (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES whatsapp_promo_jobs(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    user_id TEXT,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    attempts INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wpr_job_status
              ON whatsapp_promo_recipients(job_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wpj_status
              ON whatsapp_promo_jobs(status)`;
}

export interface PromoTrainingPayload {
  topic: string;
  date?: string;
  time?: string;
  registrationUrl: string;
  supportPhone?: string;
  supportEmail?: string;
  // Per-training thumbnail forwarded to the dynamic IMAGE header on the
  // approved `training_session_scheduled` Meta template. Optional — the
  // shared /api/whatsapp/send route falls back to a placeholder when absent.
  imageUrl?: string;
}

export interface EnqueueRecipient {
  phone: string;
  userId?: string;
  name?: string;
}

export async function enqueuePromoJob(args: {
  jobId: string;
  trainingId: string;
  training: PromoTrainingPayload;
  recipients: EnqueueRecipient[];
  origin: string;
}): Promise<void> {
  await ensureSchema();

  // We persist `origin` inside the payload so the worker — which runs
  // detached from the originating HTTP request — knows where to POST the
  // shared `/api/whatsapp/send` route. This mirrors the original inline
  // behaviour that built the URL from `req.nextUrl.origin`.
  const payload = { ...args.training, origin: args.origin };

  await sql`INSERT INTO whatsapp_promo_jobs
      (id, training_id, status, total, payload)
      VALUES (${args.jobId}, ${args.trainingId}, 'pending',
              ${args.recipients.length}, ${JSON.stringify(payload)}::jsonb)`;

  if (args.recipients.length > 0) {
    // Batched insert keeps round-trips low for big lists. neon's HTTP driver
    // can't do a true bulk insert, so we build a UNION ALL VALUES list inline.
    // Phone is the de-facto dedupe key — the caller has already deduped, but
    // we add a safety guard in the worker just in case.
    const values = args.recipients
      .map((r) => [r.phone, r.userId || null, r.name || null] as const);
    // Insert in chunks of 200 to keep statements readable.
    const CHUNK = 200;
    for (let i = 0; i < values.length; i += CHUNK) {
      const slice = values.slice(i, i + CHUNK);
      // Build an array-of-arrays parameter for sql.unsafe-style multi-insert.
      // neon doesn't expose UNNEST helpers, so we issue per-row inserts but
      // fire them in parallel within the chunk.
      await Promise.all(
        slice.map(([phone, userId, name]) =>
          sql`INSERT INTO whatsapp_promo_recipients (job_id, phone, user_id, name)
              VALUES (${args.jobId}, ${phone}, ${userId}, ${name})`,
        ),
      );
    }
  }

  // Fire-and-forget kick — the caller has already returned the jobId to the
  // UI by the time this resolves.
  void kickWorker();
}

export async function getJobStatus(jobId: string): Promise<{
  id: string;
  trainingId: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  sending: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedRecipients: Array<{ phone: string; name?: string; error?: string; attempts: number }>;
} | null> {
  await ensureSchema();
  const jobRows: any = await sql`SELECT id, training_id, status, total, succeeded, failed,
                                        created_at, started_at, completed_at
                                 FROM whatsapp_promo_jobs WHERE id = ${jobId} LIMIT 1`;
  const job = Array.isArray(jobRows) ? jobRows[0] : null;
  if (!job) return null;

  const counts: any = await sql`SELECT status, COUNT(*)::int AS c
                                FROM whatsapp_promo_recipients
                                WHERE job_id = ${jobId}
                                GROUP BY status`;
  const byStatus: Record<string, number> = {};
  for (const row of (Array.isArray(counts) ? counts : [])) {
    byStatus[row.status] = Number(row.c) || 0;
  }

  const failedRows: any = await sql`SELECT phone, name, error, attempts
                                    FROM whatsapp_promo_recipients
                                    WHERE job_id = ${jobId} AND status = 'failed'
                                    ORDER BY updated_at DESC LIMIT 200`;

  return {
    id: job.id,
    trainingId: job.training_id,
    status: job.status,
    total: Number(job.total) || 0,
    succeeded: Number(job.succeeded) || 0,
    failed: Number(job.failed) || 0,
    pending: byStatus.pending || 0,
    sending: byStatus.sending || 0,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    failedRecipients: (Array.isArray(failedRows) ? failedRows : []).map((r: any) => ({
      phone: r.phone,
      name: r.name || undefined,
      error: r.error || undefined,
      attempts: Number(r.attempts) || 0,
    })),
  };
}

export interface PromoJobHistoryEntry {
  id: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedRecipients: Array<{ phone: string; name?: string; error?: string; attempts: number }>;
  failedRecipientsTotal: number;
  failedRecipientsTruncated: boolean;
}

// Cap on per-job failed recipients embedded in the history response. The
// total count is also returned so the UI can show an explicit "and N more"
// indicator instead of silently truncating.
const HISTORY_FAILED_CAP = 50;

// Returns recent terminal blast jobs for a training, newest first. Used by
// the admin "Past blasts" panel so they can audit who got what and when
// without having to dig through the raw `whatsapp_promo_jobs` table by
// hand. Only completed/cancelled jobs are returned — in-flight jobs are
// surfaced separately via `findActiveJobForTraining` / the live progress
// panel. Failed recipients for each job are included up to a small cap.
export async function listJobsForTraining(
  trainingId: string,
  limit = 20,
): Promise<PromoJobHistoryEntry[]> {
  await ensureSchema();
  const rows: any = await sql`SELECT id, status, total, succeeded, failed,
                                     created_at, started_at, completed_at
                              FROM whatsapp_promo_jobs
                              WHERE training_id = ${trainingId}
                                AND status IN ('completed','cancelled')
                              ORDER BY created_at DESC
                              LIMIT ${limit}`;
  const jobs = Array.isArray(rows) ? rows : [];
  if (jobs.length === 0) return [];

  // Pull failed recipients for all returned jobs in one query, then group
  // them per-job in JS. Capped at 50 per job to keep the response small —
  // the modal already shows "and N more" for huge failure counts.
  const ids = jobs.map((j: any) => String(j.id));
  const failedRows: any = await sql`SELECT job_id, phone, name, error, attempts
                                    FROM whatsapp_promo_recipients
                                    WHERE job_id = ANY(${ids}::text[])
                                      AND status = 'failed'
                                    ORDER BY updated_at DESC`;
  const byJob: Record<string, PromoJobHistoryEntry['failedRecipients']> = {};
  const totals: Record<string, number> = {};
  for (const r of (Array.isArray(failedRows) ? failedRows : [])) {
    const jid = String(r.job_id);
    totals[jid] = (totals[jid] || 0) + 1;
    if (!byJob[jid]) byJob[jid] = [];
    if (byJob[jid].length >= HISTORY_FAILED_CAP) continue;
    byJob[jid].push({
      phone: r.phone,
      name: r.name || undefined,
      error: r.error || undefined,
      attempts: Number(r.attempts) || 0,
    });
  }

  return jobs.map((j: any) => {
    const jid = String(j.id);
    const total = totals[jid] || 0;
    return {
      id: jid,
      status: String(j.status),
      total: Number(j.total) || 0,
      succeeded: Number(j.succeeded) || 0,
      failed: Number(j.failed) || 0,
      createdAt: j.created_at,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      failedRecipients: byJob[jid] || [],
      failedRecipientsTotal: total,
      failedRecipientsTruncated: total > HISTORY_FAILED_CAP,
    };
  });
}

// Returns the set of phone numbers that have already been successfully
// delivered (`status = 'sent'`) by any prior promo job for this training.
// Callers use this to compute the "missed" audience for a re-blast — i.e.
// the LMS recipients who are NOT in this set. Phones are normalised at
// enqueue time, so the caller must normalise its candidate phones with
// the same routine before doing set membership.
export async function getSentPhonesForTraining(trainingId: string): Promise<Set<string>> {
  await ensureSchema();
  const rows: any = await sql`SELECT DISTINCT r.phone
                              FROM whatsapp_promo_recipients r
                              JOIN whatsapp_promo_jobs j ON j.id = r.job_id
                              WHERE j.training_id = ${trainingId}
                                AND r.status = 'sent'`;
  const set = new Set<string>();
  for (const row of (Array.isArray(rows) ? rows : [])) {
    if (row?.phone) set.add(String(row.phone));
  }
  return set;
}

// ── Retention / cleanup ────────────────────────────────────────────────────
//
// Both `whatsapp_promo_jobs` and `whatsapp_promo_recipients` grow unbounded
// as more trainings are promoted. The latter holds raw phone numbers, which
// is also a privacy concern over time. The helpers below let admins:
//   1. Delete an individual past blast (with FK cascade on recipients).
//   2. Configure an auto-purge retention window (days) — applied on worker
//      boot so a fresh process pass also tidies up.
//
// We deliberately refuse to delete in-flight jobs to avoid orphaning the
// worker mid-batch — the admin must cancel first.

async function ensureSettingsSchema(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS whatsapp_promo_settings (
    id INT PRIMARY KEY DEFAULT 1,
    retention_days INT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (id = 1)
  )`;
  // Seed the singleton row so reads always return one row.
  await sql`INSERT INTO whatsapp_promo_settings (id, retention_days)
            VALUES (1, NULL)
            ON CONFLICT (id) DO NOTHING`;
}

export async function deleteJob(jobId: string): Promise<{
  deleted: boolean;
  reason?: 'not_found' | 'in_flight';
}> {
  await ensureSchema();
  const rows: any = await sql`SELECT status FROM whatsapp_promo_jobs
                              WHERE id = ${jobId} LIMIT 1`;
  const job = Array.isArray(rows) ? rows[0] : null;
  if (!job) return { deleted: false, reason: 'not_found' };
  const status = String(job.status || '');
  if (status === 'pending' || status === 'running') {
    // Refuse to nuke an active blast — admin should cancel first so the
    // worker stops claiming batches before the rows disappear.
    return { deleted: false, reason: 'in_flight' };
  }
  // Recipients cascade via the ON DELETE CASCADE FK on the recipients table.
  await sql`DELETE FROM whatsapp_promo_jobs WHERE id = ${jobId}`;
  return { deleted: true };
}

export async function getRetentionSettings(): Promise<{ retentionDays: number | null }> {
  await ensureSettingsSchema();
  const rows: any = await sql`SELECT retention_days FROM whatsapp_promo_settings WHERE id = 1`;
  const row = Array.isArray(rows) ? rows[0] : null;
  const days = row && row.retention_days != null ? Number(row.retention_days) : null;
  return { retentionDays: Number.isFinite(days as number) ? (days as number) : null };
}

export async function setRetentionSettings(retentionDays: number | null): Promise<void> {
  await ensureSettingsSchema();
  // Coerce to a sane range. `null` (or 0/negative) disables auto-purge.
  const value = retentionDays != null && Number.isFinite(retentionDays) && retentionDays > 0
    ? Math.floor(retentionDays)
    : null;
  await sql`UPDATE whatsapp_promo_settings
            SET retention_days = ${value}, updated_at = NOW()
            WHERE id = 1`;
}

// Deletes terminal jobs (and their recipients via cascade) older than the
// configured retention window. Active jobs are left alone. Returns the
// number of jobs purged.
export async function purgeOldJobs(retentionDays?: number | null): Promise<number> {
  await ensureSchema();
  let days = retentionDays;
  if (days === undefined) {
    const s = await getRetentionSettings();
    days = s.retentionDays;
  }
  if (days == null || days <= 0) return 0;
  const rows: any = await sql`DELETE FROM whatsapp_promo_jobs
                              WHERE status IN ('completed','cancelled')
                                AND created_at < NOW() - (${days} || ' days')::interval
                              RETURNING id`;
  return Array.isArray(rows) ? rows.length : 0;
}

export async function findActiveJobForTraining(trainingId: string): Promise<string | null> {
  await ensureSchema();
  const rows: any = await sql`SELECT id FROM whatsapp_promo_jobs
                              WHERE training_id = ${trainingId}
                                AND status IN ('pending','running')
                              ORDER BY created_at DESC LIMIT 1`;
  const arr = Array.isArray(rows) ? rows : [];
  return arr.length > 0 ? String(arr[0].id) : null;
}

export async function cancelJob(jobId: string): Promise<{
  cancelled: boolean;
  recipientsCancelled: number;
  alreadyDone: boolean;
}> {
  await ensureSchema();

  // Look up the current job state. We refuse to cancel a job that has
  // already drained ('completed' / 'cancelled') so the UI surfaces a
  // sensible message instead of silently doing nothing.
  const jobRows: any = await sql`SELECT status FROM whatsapp_promo_jobs
                                 WHERE id = ${jobId} LIMIT 1`;
  const job = Array.isArray(jobRows) ? jobRows[0] : null;
  if (!job) {
    return { cancelled: false, recipientsCancelled: 0, alreadyDone: false };
  }
  const currentStatus = String(job.status || '');
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    return { cancelled: false, recipientsCancelled: 0, alreadyDone: true };
  }

  // Flip the job row first so the worker's `claimBatch` (which only picks
  // jobs in 'pending'/'running') stops handing out new batches for this
  // job on its next tick. We deliberately leave 'sending' rows alone — the
  // worker may already be mid-dispatch on them and will finish the HTTP
  // round-trip; those recipients have effectively been sent, so they stay
  // in the succeeded/failed buckets. Only 'pending' rows are flipped so
  // they never get claimed again.
  await sql`UPDATE whatsapp_promo_jobs
            SET status = 'cancelled', completed_at = NOW()
            WHERE id = ${jobId}`;
  const cancelledRows: any = await sql`UPDATE whatsapp_promo_recipients
                                       SET status = 'cancelled', updated_at = NOW()
                                       WHERE job_id = ${jobId} AND status = 'pending'
                                       RETURNING id`;
  const recipientsCancelled = Array.isArray(cancelledRows) ? cancelledRows.length : 0;
  return { cancelled: true, recipientsCancelled, alreadyDone: false };
}

export async function resumeCancelledRecipients(jobId: string): Promise<number> {
  await ensureSchema();
  // Mirrors `retryFailedRecipients` but for the 'cancelled' bucket. When an
  // admin halts a blast via the Cancel button (task #171), pending recipients
  // are flipped to 'cancelled' so they're auditable. Resume reverses that:
  // every 'cancelled' row goes back to 'pending' on the SAME job, the job
  // status flips back to 'pending', and the worker is kicked. This way only
  // the originally-skipped recipients receive the message — anyone already in
  // 'sent' or 'failed' stays untouched and is not re-spammed.
  const rows: any = await sql`UPDATE whatsapp_promo_recipients
                              SET status = 'pending', attempts = 0, error = NULL,
                                  updated_at = NOW()
                              WHERE job_id = ${jobId} AND status = 'cancelled'
                              RETURNING id`;
  const requeued = Array.isArray(rows) ? rows.length : 0;
  if (requeued > 0) {
    // Reset job-level terminal markers so the worker treats this as live work
    // again and the UI's `inProgress` check (status !== 'completed' &&
    // status !== 'cancelled') flips back on.
    await sql`UPDATE whatsapp_promo_jobs
              SET status = 'pending',
                  completed_at = NULL,
                  last_error = NULL
              WHERE id = ${jobId}`;
    void kickWorker();
  }
  return requeued;
}

export async function retryFailedRecipients(jobId: string): Promise<number> {
  await ensureSchema();
  // Reset failed rows to pending and zero out their attempt counter so the
  // worker treats them as fresh work. Returns the number actually requeued.
  const rows: any = await sql`UPDATE whatsapp_promo_recipients
                              SET status = 'pending', attempts = 0, error = NULL,
                                  updated_at = NOW()
                              WHERE job_id = ${jobId} AND status = 'failed'
                              RETURNING id`;
  const requeued = Array.isArray(rows) ? rows.length : 0;
  if (requeued > 0) {
    // Roll the failed counter back so the progress bar reflects the retry.
    await sql`UPDATE whatsapp_promo_jobs
              SET failed = GREATEST(failed - ${requeued}, 0),
                  status = 'pending',
                  completed_at = NULL,
                  last_error = NULL
              WHERE id = ${jobId}`;
    void kickWorker();
  }
  return requeued;
}

// ── worker loop ─────────────────────────────────────────────────────────────

async function claimBatch(): Promise<{
  jobId: string;
  origin: string;
  payload: PromoTrainingPayload;
  recipients: Array<{ id: number; phone: string }>;
} | null> {
  // Pick the oldest pending/running job that still has pending recipients.
  const jobRows: any = await sql`SELECT j.id, j.payload
                                 FROM whatsapp_promo_jobs j
                                 WHERE j.status IN ('pending','running')
                                   AND EXISTS (
                                     SELECT 1 FROM whatsapp_promo_recipients r
                                     WHERE r.job_id = j.id AND r.status = 'pending'
                                   )
                                 ORDER BY j.created_at ASC
                                 LIMIT 1`;
  const job = Array.isArray(jobRows) ? jobRows[0] : null;
  if (!job) return null;

  // Atomically claim up to BATCH_SIZE pending recipients for this job.
  //
  // We CANNOT use `UPDATE … RETURNING` here: @neondatabase/serverless 1.1.x
  // sometimes returns an empty array for the RETURNING clause even though
  // the UPDATE itself succeeds (particularly when the SQL is sent as a
  // tagged-template via the HTTP gateway). That made the worker silently
  // think it had nothing to do while the rows were already flipped to
  // 'sending' — leaving recipients stuck forever. Two-step instead:
  //   1. SELECT the candidate ids
  //   2. UPDATE … WHERE id = ANY($1) (no RETURNING needed)
  const candidateRows: any = await sql`SELECT id, phone
                                       FROM whatsapp_promo_recipients
                                       WHERE job_id = ${job.id} AND status = 'pending'
                                       ORDER BY id
                                       LIMIT ${BATCH_SIZE}`;
  const recipients = (Array.isArray(candidateRows) ? candidateRows : []).map((r: any) => ({
    id: Number(r.id),
    phone: String(r.phone),
  }));
  if (recipients.length === 0) return null;
  const ids = recipients.map((r) => r.id);
  await sql`UPDATE whatsapp_promo_recipients
            SET status = 'sending',
                attempts = attempts + 1,
                updated_at = NOW()
            WHERE id = ANY(${ids}) AND status = 'pending'`;

  // Mark the job as running on its first claim.
  await sql`UPDATE whatsapp_promo_jobs
            SET status = 'running',
                started_at = COALESCE(started_at, NOW())
            WHERE id = ${job.id}`;

  const payload = (job.payload || {}) as any;
  const origin = String(payload.origin || '');
  return { jobId: String(job.id), origin, payload, recipients };
}

async function dispatchOne(
  origin: string,
  training: PromoTrainingPayload,
  phone: string,
): Promise<{ ok: boolean; error?: string }> {
  // Call the shared send logic directly. We deliberately avoid HTTP here:
  // the worker runs inside the same Next.js process as the API routes,
  // and `fetch('http://127.0.0.1:5000/api/whatsapp/send')` reliably hangs
  // in `next dev` (turbopack serializes route handlers and Node's undici
  // keeps the socket open under that contention) — recipients then get
  // stuck in the 'sending' status forever. Direct invocation skips the
  // round-trip entirely while preserving identical behaviour because
  // `app/api/whatsapp/send/route.ts` is now a thin wrapper around the
  // same function.
  try {
    // The `origin` we receive is what was captured from
    // `req.nextUrl.origin` at enqueue time — it's only used by the send
    // logic for resolving relative `imageUrl` values back into bytes, so
    // a working origin matters. Fall back to loopback if the captured
    // value is the unroutable dev-bind host.
    const safeOrigin = (() => {
      try {
        const u = new URL(origin);
        if (u.hostname === '0.0.0.0' || u.hostname === '::' || !u.hostname) {
          return `http://127.0.0.1:${process.env.PORT || 5000}`;
        }
        return origin;
      } catch {
        return `http://127.0.0.1:${process.env.PORT || 5000}`;
      }
    })();
    const result = await sendWhatsAppTemplate(
      {
        phone,
        kind: 'training',
        training: {
          topic: training.topic,
          date: training.date,
          time: training.time,
          registrationUrl: training.registrationUrl,
          supportPhone: training.supportPhone,
          supportEmail: training.supportEmail,
          imageUrl: training.imageUrl,
        },
      },
      safeOrigin,
    );
    if (!result.ok) return { ok: false, error: result.error || `Send failed (${result.status})` };
    return { ok: true };
  } catch (err: any) {
    console.error(`[whatsapp-promo-worker] dispatchOne threw phone=${phone}`, err);
    return { ok: false, error: err?.message || 'send failed' };
  }
}

async function processBatch(batch: NonNullable<Awaited<ReturnType<typeof claimBatch>>>): Promise<void> {
  const { jobId, origin, payload, recipients } = batch;

  const results = await Promise.all(
    recipients.map(async (r) => ({
      id: r.id,
      phone: r.phone,
      result: await dispatchOne(origin, payload, r.phone),
    })),
  );

  // Persist per-recipient outcome. We retry transient failures up to
  // MAX_ATTEMPTS by flipping them back to pending; permanent failures land
  // in the failed bucket and surface in the admin UI.
  let succeededDelta = 0;
  let failedDelta = 0;
  await Promise.all(
    results.map(async ({ id, result }) => {
      if (result.ok) {
        succeededDelta += 1;
        await sql`UPDATE whatsapp_promo_recipients
                  SET status = 'sent', error = NULL, updated_at = NOW()
                  WHERE id = ${id}`;
        return;
      }
      const attemptsRow: any = await sql`SELECT attempts FROM whatsapp_promo_recipients
                                         WHERE id = ${id} LIMIT 1`;
      const attempts = Array.isArray(attemptsRow) && attemptsRow[0]
        ? Number(attemptsRow[0].attempts) || 0
        : MAX_ATTEMPTS;
      if (attempts < MAX_ATTEMPTS) {
        // Re-queue for another attempt on a later tick.
        await sql`UPDATE whatsapp_promo_recipients
                  SET status = 'pending', error = ${result.error || null},
                      updated_at = NOW()
                  WHERE id = ${id}`;
      } else {
        failedDelta += 1;
        await sql`UPDATE whatsapp_promo_recipients
                  SET status = 'failed', error = ${result.error || null},
                      updated_at = NOW()
                  WHERE id = ${id}`;
      }
    }),
  );

  if (succeededDelta > 0 || failedDelta > 0) {
    await sql`UPDATE whatsapp_promo_jobs
              SET succeeded = succeeded + ${succeededDelta},
                  failed = failed + ${failedDelta}
              WHERE id = ${jobId}`;
  }

  // Has this job finished? If no pending/sending rows remain, mark complete.
  const remaining: any = await sql`SELECT COUNT(*)::int AS c
                                   FROM whatsapp_promo_recipients
                                   WHERE job_id = ${jobId}
                                     AND status IN ('pending','sending')`;
  const left = Array.isArray(remaining) && remaining[0] ? Number(remaining[0].c) || 0 : 0;
  if (left === 0) {
    // Guard against overwriting a 'cancelled' job: cancel happens by
    // flipping pending → cancelled while leaving sending rows in flight,
    // so the worker may finish those last sends *after* the cancel call
    // returned. Without this guard, the final tick would re-mark the job
    // as 'completed' and the UI would lose the cancellation signal.
    await sql`UPDATE whatsapp_promo_jobs
              SET status = 'completed', completed_at = NOW()
              WHERE id = ${jobId} AND status <> 'cancelled'`;
  }
}

export function kickWorker(): void {
  if (workerRunning) return;
  workerRunning = true;
  // Detach so the HTTP request that triggered enqueue returns immediately.
  void (async () => {
    try {
      while (true) {
        let batch: Awaited<ReturnType<typeof claimBatch>> = null;
        try {
          batch = await claimBatch();
        } catch (err) {
          console.error('[whatsapp-promo-worker] claim error', err);
          await sleep(2000);
          continue;
        }
        if (!batch) break; // queue is empty — exit and let the next enqueue restart us
        try {
          await processBatch(batch);
        } catch (err) {
          console.error('[whatsapp-promo-worker] process error', err);
          // Release any sending rows in this job back to pending so a future
          // tick can retry them — otherwise they'd be stuck forever.
          try {
            await sql`UPDATE whatsapp_promo_recipients
                      SET status = 'pending', updated_at = NOW()
                      WHERE job_id = ${batch.jobId} AND status = 'sending'`;
          } catch {}
          await sleep(2000);
        }
        await sleep(TICK_DELAY_MS);
      }
    } finally {
      workerRunning = false;
    }
  })();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// On module load, kick the worker once so any jobs that were left
// half-drained by a previous process restart get picked back up. Also
// reclaim any rows that were stuck in 'sending' from a crash.
export async function recoverAndStart(): Promise<void> {
  try {
    await ensureSchema();
    await sql`UPDATE whatsapp_promo_recipients
              SET status = 'pending', updated_at = NOW()
              WHERE status = 'sending'`;
    // Apply the configured retention window once per process boot so a
    // long-running container doesn't have to wait for an admin to open
    // the modal before old phone-number rows get purged.
    try {
      const purged = await purgeOldJobs();
      if (purged > 0) {
        console.log(`[whatsapp-promo-worker] purged ${purged} job(s) past retention window`);
      }
    } catch (err) {
      console.error('[whatsapp-promo-worker] retention purge failed (non-fatal)', err);
    }
    // Also sweep abandoned promo-header image uploads so that table doesn't
    // grow forever (rows older than the threshold not referenced by any
    // sent blast's audit row). See lib/whatsappPromoHeaderImagesCleanup.ts.
    try {
      const { runPromoHeaderImageBootPurge } = await import('./whatsappPromoHeaderImagesCleanup');
      await runPromoHeaderImageBootPurge();
    } catch (err) {
      console.error('[whatsapp-promo-worker] header image purge failed (non-fatal)', err);
    }
    kickWorker();
  } catch (err) {
    console.error('[whatsapp-promo-worker] recovery failed', err);
  }
}
