import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import {
  enqueuePromoJob,
  getJobStatus,
  findActiveJobForTraining,
  listJobsForTraining,
  retryFailedRecipients,
  resumeCancelledRecipients,
  cancelJob,
  deleteJob,
  getRetentionSettings,
  setRetentionSettings,
  purgeOldJobs,
  recoverAndStart,
  getSentPhonesForTraining,
} from '@/lib/whatsappPromoWorker';

// "Promote on WhatsApp" fan-out endpoint.
//
// Historically this route fanned out the WhatsApp UTILITY template inline
// (concurrency 8) inside a single HTTP request. That worked for the LMS
// list of ~8 users, but once it grows past a few hundred recipients the
// request will hit serverless / proxy timeouts and the blast will only
// partially complete with no resume path.
//
// Now the route only enqueues a job (DB-backed), returning the jobId
// immediately. A separate in-process worker (`lib/whatsappPromoWorker.ts`)
// drains the queue and updates per-recipient state, so the UI can poll for
// progress and retry failed recipients without re-sending to anyone who
// already received the message.
//
// Endpoints
// ---------
//   POST { trainingId, training, dryRun: true }      → count audience only
//   POST { trainingId, training }                    → enqueue blast, returns jobId
//   POST { trainingId, action: 'retry', jobId }      → retry failed recipients
//   GET  ?jobId=<id>                                  → fetch progress + failures
//   GET  ?trainingId=<id>&active=1                    → find active job for training
//   GET  ?trainingId=<id>&history=1                   → list recent jobs for training
//
// Notes on opt-out: any LMS user with `receiveTrainingAlerts === false` in
// their JSONB record is skipped. Default is opted-IN (so existing users
// receive promos until they explicitly turn it off in the LMS portal).

type LmsUserRow = { id: string; data: any };

const normalizePhone = (raw: any): string | null => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Treat as Indian number if no country code, otherwise pass through.
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

// Run worker recovery once per Node process so any rows that were left
// mid-flight by a previous restart get picked back up. Idempotent.
let recoveredOnce = false;
const ensureWorkerRecovered = async () => {
  if (recoveredOnce) return;
  recoveredOnce = true;
  await recoverAndStart();
};

async function loadAudience(
  includeImported: boolean = false,
): Promise<Array<{ phone: string; userId: string; name?: string; source: 'lms' | 'imported' }>> {
  const seen = new Set<string>();
  const recipients: Array<{ phone: string; userId: string; name?: string; source: 'lms' | 'imported' }> = [];

  // LMS users — opted-in by default; explicit opt-outs are skipped.
  try {
    const result: any = await sql`SELECT id, data FROM lms_users`;
    const users: LmsUserRow[] = Array.isArray(result) ? result : [];
    for (const row of users) {
      const u = row?.data || {};
      if (u?.receiveTrainingAlerts === false) continue;
      const phone = normalizePhone(u?.phone || u?.whatsapp || u?.mobile);
      if (!phone) continue;
      if (seen.has(phone)) continue;
      seen.add(phone);
      recipients.push({ phone, userId: row.id, name: u?.name || u?.fullName, source: 'lms' });
    }
  } catch (err) {
    console.error('training-promo: lms_users load failed', err);
  }

  // Manually-added / CSV-imported marketing leads — only when the admin
  // explicitly asks for them. Mirrors the multi-training-promo route so
  // the single-training modal exposes the same audience choice.
  if (includeImported) {
    try {
      const mp: any = await sql`SELECT id, data FROM marketing_participants`;
      const rows: LmsUserRow[] = Array.isArray(mp) ? mp : [];
      for (const row of rows) {
        const u = row?.data || {};
        const raw = u?.mobile ? `${u?.countryCode || ''}${u?.mobile}` : (u?.whatsapp || u?.phone || '');
        const phone = normalizePhone(raw);
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        recipients.push({ phone, userId: row.id, name: u?.fullName || u?.name, source: 'imported' });
      }
    } catch (err) {
      console.error('training-promo: marketing_participants load failed', err);
    }
  }

  return recipients;
}

export async function GET(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;

  await ensureWorkerRecovered();

  const jobId = req.nextUrl.searchParams.get('jobId');
  const trainingId = req.nextUrl.searchParams.get('trainingId');
  const active = req.nextUrl.searchParams.get('active');
  const history = req.nextUrl.searchParams.get('history');

  if (jobId) {
    const status = await getJobStatus(jobId);
    if (!status) {
      return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, job: status });
  }

  if (trainingId && history === '1') {
    // Cap at 50 to keep the response bounded; the UI default is 20.
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
    const limit = Math.max(1, Math.min(50, isNaN(limitParam) ? 20 : limitParam));
    const jobs = await listJobsForTraining(trainingId, limit);
    return NextResponse.json({ ok: true, jobs });
  }

  // Retention settings — exposed alongside the history panel so the UI can
  // load both in one round-trip-ish flow. Returns the current auto-purge
  // window (null = disabled).
  if (req.nextUrl.searchParams.get('settings') === '1') {
    const settings = await getRetentionSettings();
    return NextResponse.json({ ok: true, settings });
  }

  if (trainingId && active) {
    const id = await findActiveJobForTraining(trainingId);
    if (!id) return NextResponse.json({ ok: true, job: null });
    const status = await getJobStatus(id);
    return NextResponse.json({ ok: true, job: status });
  }

  return NextResponse.json(
    { ok: false, error: 'Provide ?jobId=... or ?trainingId=...&active=1 or ?trainingId=...&history=1' },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  // Gate behind the same admin-session check used by other admin-only
  // endpoints. Without this, anyone could fan out template messages to the
  // entire LMS user list and burn through the WhatsApp Cloud API balance.
  const authError = await requireAdminSession(req);
  if (authError) return authError;

  await ensureWorkerRecovered();

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  // ── Cancel path ───────────────────────────────────────────────────────
  // Lets an admin halt an in-flight blast they shouldn't have started
  // (wrong link, wrong session, wrong template variables). Remaining
  // 'pending' recipients are flipped to 'cancelled' and the job row is
  // marked 'cancelled' so the worker stops claiming new batches for it.
  if (body?.action === 'cancel') {
    const jobId = String(body?.jobId || '').trim();
    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId is required' }, { status: 400 });
    }
    try {
      const result = await cancelJob(jobId);
      const job = await getJobStatus(jobId);
      if (!job) {
        return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, ...result, job });
    } catch (err: any) {
      console.error('training-promo: cancel failed', err);
      return NextResponse.json(
        { ok: false, error: err?.message || 'Cancel failed' },
        { status: 500 },
      );
    }
  }

  // ── Resume path ───────────────────────────────────────────────────────
  // Pairs with the Cancel button (task #171). Flips every 'cancelled'
  // recipient row on the same job back to 'pending', resets the job's
  // status to 'pending', and re-kicks the worker. Recipients that were
  // already 'sent' or 'failed' are left untouched, so no one gets the
  // promo twice.
  if (body?.action === 'resume') {
    const jobId = String(body?.jobId || '').trim();
    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId is required' }, { status: 400 });
    }
    try {
      const requeued = await resumeCancelledRecipients(jobId);
      const job = await getJobStatus(jobId);
      if (!job) {
        return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, requeued, job });
    } catch (err: any) {
      console.error('training-promo: resume failed', err);
      return NextResponse.json(
        { ok: false, error: err?.message || 'Resume failed' },
        { status: 500 },
      );
    }
  }

  // ── Re-blast missed users only ───────────────────────────────────────
  // Enqueues a new job seeded with LMS recipients who are NOT in the
  // succeeded list of any prior job for this training. Useful when a
  // previous blast was cancelled mid-way, or when new LMS users have
  // signed up since the last promo and the admin wants to reach only
  // the people who never received the message in the first place.
  if (body?.action === 'reblast-missed') {
    const trainingId = String(body?.trainingId || '').trim();
    const training = body?.training || {};
    if (!trainingId) {
      return NextResponse.json({ ok: false, error: 'trainingId is required' }, { status: 400 });
    }
    if (!training?.topic || !training?.registrationUrl) {
      return NextResponse.json(
        { ok: false, error: 'training.topic and training.registrationUrl are required' },
        { status: 400 },
      );
    }

    // Refuse if a blast is already in flight — otherwise we'd race the
    // worker and double-send to people the active job is about to reach.
    let activeId: string | null = null;
    try { activeId = await findActiveJobForTraining(trainingId); } catch {}
    if (activeId) {
      const job = await getJobStatus(activeId);
      return NextResponse.json({
        ok: true,
        enqueued: false,
        reused: true,
        jobId: activeId,
        job,
        message: 'A blast is already running for this training.',
      });
    }

    const includeImportedReblast = body?.audience === 'lms+imported';
    let fullAudience: Array<{ phone: string; userId: string; name?: string; source: 'lms' | 'imported' }> = [];
    let alreadySent: Set<string>;
    try {
      [fullAudience, alreadySent] = await Promise.all([
        loadAudience(includeImportedReblast),
        getSentPhonesForTraining(trainingId),
      ]);
    } catch (err) {
      console.error('training-promo: reblast-missed audience load failed', err);
      return NextResponse.json(
        { ok: false, error: 'Failed to compute missed audience' },
        { status: 500 },
      );
    }

    const missed = fullAudience.filter(r => !alreadySent.has(r.phone));

    if (missed.length === 0) {
      return NextResponse.json({
        ok: true,
        enqueued: false,
        jobId: null,
        total: 0,
        skipped: alreadySent.size,
        message: 'No missed recipients — every eligible LMS user has already received this promo.',
      });
    }

    const newJobId = randomUUID();
    try {
      await enqueuePromoJob({
        jobId: newJobId,
        trainingId,
        training: {
          topic: training.topic,
          date: training.date,
          time: training.time,
          registrationUrl: training.registrationUrl,
          supportPhone: training.supportPhone,
          supportEmail: training.supportEmail,
          imageUrl: training.imageUrl,
        },
        recipients: missed,
        origin: req.nextUrl.origin,
      });
    } catch (err: any) {
      console.error('training-promo: reblast-missed enqueue failed', err);
      return NextResponse.json(
        { ok: false, error: err?.message || 'Failed to enqueue blast' },
        { status: 500 },
      );
    }

    // Mirror the audit log behaviour of the standard enqueue path so
    // re-blasts show up in the same `whatsapp_training_promos` audit
    // table and not just the `whatsapp_promo_jobs` worker table.
    try {
      await sql`CREATE TABLE IF NOT EXISTS whatsapp_training_promos (
        id SERIAL PRIMARY KEY,
        training_id TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        attempted INT NOT NULL,
        succeeded INT NOT NULL,
        failed INT NOT NULL,
        data JSONB
      )`;
      await sql`INSERT INTO whatsapp_training_promos
        (training_id, attempted, succeeded, failed, data)
        VALUES (${trainingId}, ${missed.length}, 0, 0,
                ${JSON.stringify({
                  topic: training.topic,
                  jobId: newJobId,
                  queued: true,
                  reblastMissed: true,
                  skipped: alreadySent.size,
                  audience: includeImportedReblast ? 'lms+imported' : 'lms',
                  breakdown: {
                    lms: missed.filter(r => r.source === 'lms').length,
                    imported: missed.filter(r => r.source === 'imported').length,
                  },
                })}::jsonb)`;
    } catch (err) {
      console.error('training-promo: reblast-missed audit log insert failed (non-fatal)', err);
    }

    const job = await getJobStatus(newJobId);
    return NextResponse.json({
      ok: true,
      enqueued: true,
      reblastMissed: true,
      jobId: newJobId,
      total: missed.length,
      skipped: alreadySent.size,
      job,
    });
  }

  // ── Delete path ───────────────────────────────────────────────────────
  // Removes a single past blast (and its recipient rows via FK cascade) so
  // admins can prune the history panel and shed the privacy footprint of
  // stored phone numbers. Active jobs are refused — admin must cancel
  // first so the worker isn't yanked out from under itself.
  if (body?.action === 'delete') {
    const jobId = String(body?.jobId || '').trim();
    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId is required' }, { status: 400 });
    }
    try {
      const result = await deleteJob(jobId);
      if (!result.deleted) {
        if (result.reason === 'not_found') {
          return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
        }
        if (result.reason === 'in_flight') {
          return NextResponse.json(
            { ok: false, error: 'Cancel the blast before deleting it.' },
            { status: 409 },
          );
        }
        return NextResponse.json({ ok: false, error: 'Delete failed' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, deleted: true, jobId });
    } catch (err: any) {
      console.error('training-promo: delete failed', err);
      return NextResponse.json(
        { ok: false, error: err?.message || 'Delete failed' },
        { status: 500 },
      );
    }
  }

  // ── Retention settings update + on-demand purge ───────────────────────
  if (body?.action === 'setSettings') {
    const raw = body?.retentionDays;
    // Accept null / 0 / negative as "disabled". Anything else must coerce
    // to a positive integer ≤ 3650 (10 years) — guards against typos.
    let next: number | null = null;
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 3650) {
        return NextResponse.json(
          { ok: false, error: 'retentionDays must be between 0 and 3650 (0 disables auto-purge)' },
          { status: 400 },
        );
      }
      next = n > 0 ? Math.floor(n) : null;
    }
    try {
      await setRetentionSettings(next);
      // Fire the purge immediately so shrinking the window takes effect
      // right away instead of waiting for the next process boot.
      let purged = 0;
      try { purged = await purgeOldJobs(next); } catch (err) {
        console.error('training-promo: immediate purge after setSettings failed', err);
      }
      const settings = await getRetentionSettings();
      return NextResponse.json({ ok: true, settings, purged });
    } catch (err: any) {
      console.error('training-promo: setSettings failed', err);
      return NextResponse.json(
        { ok: false, error: err?.message || 'Settings update failed' },
        { status: 500 },
      );
    }
  }

  // ── Retry path ────────────────────────────────────────────────────────
  if (body?.action === 'retry') {
    const jobId = String(body?.jobId || '').trim();
    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId is required' }, { status: 400 });
    }
    try {
      const requeued = await retryFailedRecipients(jobId);
      const job = await getJobStatus(jobId);
      return NextResponse.json({ ok: true, requeued, job });
    } catch (err: any) {
      console.error('training-promo: retry failed', err);
      return NextResponse.json(
        { ok: false, error: err?.message || 'Retry failed' },
        { status: 500 },
      );
    }
  }

  // ── Standard enqueue / dryRun path ────────────────────────────────────
  const trainingId = String(body?.trainingId || '').trim();
  const training = body?.training || {};
  const dryRun = body?.dryRun === true;
  const includeImported = body?.audience === 'lms+imported';

  if (!trainingId) {
    return NextResponse.json({ ok: false, error: 'trainingId is required' }, { status: 400 });
  }
  if (!training?.topic || !training?.registrationUrl) {
    return NextResponse.json(
      { ok: false, error: 'training.topic and training.registrationUrl are required' },
      { status: 400 },
    );
  }

  let recipients: Array<{ phone: string; userId: string; name?: string; source: 'lms' | 'imported' }> = [];
  try {
    recipients = await loadAudience(includeImported);
  } catch (err) {
    console.error('training-promo: audience fetch failed', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load recipient list' },
      { status: 500 },
    );
  }

  const breakdown = {
    lms: recipients.filter(r => r.source === 'lms').length,
    imported: recipients.filter(r => r.source === 'imported').length,
  };

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      attempted: recipients.length,
      succeeded: 0,
      failed: 0,
      breakdown,
      recipients: recipients.map(r => ({ phone: r.phone, ok: true })),
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      enqueued: false,
      jobId: null,
      total: 0,
      message: 'No eligible recipients (no phone or all opted out).',
    });
  }

  // If there's already an active job for this training, return that jobId
  // instead of starting a duplicate blast — the UI can pick up where it
  // left off without re-sending to anyone who already got the message.
  let jobId: string | null = null;
  try {
    jobId = await findActiveJobForTraining(trainingId);
  } catch (err) {
    console.error('training-promo: active-job lookup failed (continuing)', err);
  }
  if (jobId) {
    const job = await getJobStatus(jobId);
    return NextResponse.json({
      ok: true,
      enqueued: false,
      reused: true,
      jobId,
      job,
    });
  }

  const newJobId = randomUUID();
  try {
    await enqueuePromoJob({
      jobId: newJobId,
      trainingId,
      training: {
        topic: training.topic,
        date: training.date,
        time: training.time,
        registrationUrl: training.registrationUrl,
        supportPhone: training.supportPhone,
        supportEmail: training.supportEmail,
        // Per-training thumbnail drives the dynamic IMAGE header on the
        // approved `training_session_scheduled` template.
        imageUrl: training.imageUrl,
      },
      recipients,
      origin: req.nextUrl.origin,
    });
  } catch (err: any) {
    console.error('training-promo: enqueue failed', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to enqueue blast' },
      { status: 500 },
    );
  }

  // Best-effort audit log so admins can spot which trainings already had a
  // promo blast attempted. We persist into a dedicated table rather than
  // mutating the training row, so older trainings without the field stay
  // untouched. The succeeded/failed counts here are 0 — the worker updates
  // its own `whatsapp_promo_jobs` row with final totals when it finishes.
  try {
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_training_promos (
      id SERIAL PRIMARY KEY,
      training_id TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      attempted INT NOT NULL,
      succeeded INT NOT NULL,
      failed INT NOT NULL,
      data JSONB
    )`;
    await sql`INSERT INTO whatsapp_training_promos
      (training_id, attempted, succeeded, failed, data)
      VALUES (${trainingId}, ${recipients.length}, 0, 0,
              ${JSON.stringify({ topic: training.topic, jobId: newJobId, queued: true, audience: includeImported ? 'lms+imported' : 'lms', breakdown })}::jsonb)`;
  } catch (err) {
    console.error('training-promo: audit log insert failed (non-fatal)', err);
  }

  const job = await getJobStatus(newJobId);
  return NextResponse.json({
    ok: true,
    enqueued: true,
    jobId: newJobId,
    total: recipients.length,
    job,
  });
}
