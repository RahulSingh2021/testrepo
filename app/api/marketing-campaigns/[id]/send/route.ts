import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { sendMarketingBulkEmail } from '@/lib/sendEmail';
import {
  expandMergeTokens,
  buildUnsubscribeFooterHtml,
  sanitizeMarketingHtml,
  rewriteLinksForTracking,
  buildTrackingPixelHtml,
} from '@/lib/marketingHtml';
import { makeUnsubscribeToken, getUnsubscribedSet } from '@/lib/marketingUnsubscribe';
import { ensureCampaignTables } from '../../route';
import { downloadMarketingAttachment } from '@/lib/marketingAttachments';

// SMTP sends are slow + the per-recipient throttle adds 400ms each, so each
// /send request runs as a long-poll loop on the Node runtime. The client
// re-issues the POST until the campaign reports `status: 'completed'`. The
// design mirrors the existing meeting-link broadcaster.
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Public origin used to build the unsubscribe link inside each email.
function resolvePublicBase(request: NextRequest): string {
  const env = (process.env.NEXT_PUBLIC_BASE_URL
    || process.env.PUBLIC_APP_URL
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
    || ''
  ).trim().replace(/\/+$/, '');
  if (env) return /^https?:\/\//i.test(env) ? env : `https://${env}`;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : 'http://localhost:5000';
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface CampaignDataRow { data: Record<string, unknown> | null }
interface RecipientDataRow {
  id: string;
  data: {
    email?: string;
    name?: string;
    title?: string;
    organisation?: string;
    attempts?: number;
    status?: string;
    [k: string]: unknown;
  } | null;
}
interface CountRow { c: number }
interface StatusCountRow { status: string; c: number }

// Stuck-processing reaper threshold. Any recipient row that has been in
// `processing` longer than this is assumed orphaned (server crashed
// mid-send) and is flipped back to `pending` at the start of every batch
// so we can resume. Comfortably > maxDuration so we never reset a row
// that another in-flight request is still working on.
const PROCESSING_TIMEOUT_MS = 6 * 60 * 1000;

// POST /api/marketing-campaigns/[id]/send
// Atomically claims one pending recipient at a time (UPDATE … RETURNING
// with a SELECT FOR UPDATE SKIP LOCKED subquery), sends the email, and
// transitions the row to `sent` / `failed`. Concurrent /send requests
// for the same campaign are safe: row locking guarantees exactly-once
// processing per recipient. All critical persistence paths surface
// failures by throwing so we never report a send the database didn't
// actually record.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    await ensureCampaignTables();
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const failuresOnly = url.searchParams.get('failuresOnly') === '1';

    const camp = (await sql`SELECT data FROM marketing_campaigns WHERE id = ${id} LIMIT 1`) as unknown as CampaignDataRow[];
    if (!Array.isArray(camp) || camp.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const cdata = (camp[0].data || {}) as Record<string, unknown>;
    const subject = String(cdata.subject ?? '').trim() || 'Update from SafeFood Mitra';
    const baseBodyHtml = sanitizeMarketingHtml((cdata.bodyHtml as string) || '');
    // Same cap as the POST endpoint — up to 60 minutes between recipients.
    // Long delays that don't fit in the 230s safety budget below are
    // persisted as `nextAllowedAt` so the spacing is honoured across
    // separate /send batches.
    const throttleMs = Math.max(0, Math.min(60 * 60_000, Number(cdata.throttleMs) || 400));

    // Scheduling guard: a campaign with status='scheduled' must not be sent
    // until its sendAt timestamp is reached. The run-due cron flips it to
    // 'pending' at the right moment; until then this endpoint no-ops so the
    // composer's poll loop and any accidental hits stay safe.
    const sendAtRaw = typeof cdata.sendAt === 'string' ? cdata.sendAt : null;
    if (cdata.status === 'scheduled') {
      const dueTs = sendAtRaw ? new Date(sendAtRaw).getTime() : 0;
      if (!dueTs || dueTs > Date.now()) {
        return NextResponse.json({
          ok: true,
          processed: 0,
          remaining: Number(cdata.totalRecipients || 0),
          stopped: true,
          status: 'scheduled',
          sendAt: sendAtRaw,
        });
      }
      // Past due — promote to pending so the loop below claims rows.
      const promote = JSON.stringify({ status: 'pending' });
      await sql`UPDATE marketing_campaigns SET data = data || ${promote}::jsonb WHERE id = ${id}`;
      cdata.status = 'pending';
    }

    // Per-recipient pacing checkpoint. If the previous batch had to bow
    // out before its configured throttle window elapsed (e.g. a 5-minute
    // gap doesn't fit in the 230s safety budget below), it persisted
    // `nextAllowedAt`. Honour it here so consecutive sends keep the
    // exact spacing the marketer asked for, even across batches and
    // across server restarts.
    const nextAllowedAtRaw = typeof cdata.nextAllowedAt === 'string' ? cdata.nextAllowedAt : null;
    const nextAllowedAtMs = nextAllowedAtRaw ? new Date(nextAllowedAtRaw).getTime() : 0;
    if (nextAllowedAtMs && nextAllowedAtMs > Date.now()) {
      const stillPendingNow = (await sql`
        SELECT COUNT(*)::int AS c
        FROM marketing_campaign_recipients
        WHERE campaign_id = ${id} AND data->>'status' IN ('pending','processing')
      `) as unknown as CountRow[];
      const remainingNow = Number(stillPendingNow?.[0]?.c || 0);
      // If the queue actually drained while we were waiting on the
      // throttle gate, finalise the campaign here so its row state
      // matches what we report. Otherwise resume reporters polling
      // /api/marketing-campaigns/[id] would see status='sending' forever.
      if (remainingNow === 0) {
        const finalPatch = JSON.stringify({
          status: 'completed',
          finishedAt: new Date().toISOString(),
        });
        await sql`UPDATE marketing_campaigns SET data = (data - 'nextAllowedAt') || ${finalPatch}::jsonb WHERE id = ${id}`;
      }
      return NextResponse.json({
        ok: true,
        processed: 0,
        remaining: remainingNow,
        stopped: true,
        status: remainingNow === 0 ? 'completed' : 'sending',
        nextAllowedAt: remainingNow === 0 ? null : nextAllowedAtRaw,
      });
    }

    // Materialise stored attachments once per /send call and reuse the
    // same Buffer objects across every recipient in the loop. The bytes
    // live in object storage now, so this is a single download per file
    // per /send batch — not per recipient. Legacy campaigns may still
    // carry inline `contentBase64`; we honour that shape too so old
    // history rows can be resumed.
    interface StoredAtt {
      filename?: string;
      contentType?: string;
      storageKey?: string;
      contentBase64?: string;
    }
    const rawAttachments: StoredAtt[] = Array.isArray(cdata.attachments) ? cdata.attachments as StoredAtt[] : [];
    const mailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    for (const a of rawAttachments) {
      const filename = String(a?.filename || 'attachment');
      const contentType = String(a?.contentType || 'application/octet-stream');
      let buf: Buffer | null = null;
      if (a?.storageKey) {
        try {
          buf = await downloadMarketingAttachment(a.storageKey);
        } catch (err) {
          // Fail loudly — silently dropping an attachment would send the
          // campaign without the file the marketer expected. Operator can
          // re-upload + restart.
          console.error(`Failed to fetch attachment "${filename}" from object storage:`, err);
          return NextResponse.json({
            error: `Could not load attachment "${filename}" from storage. ${err instanceof Error ? err.message : ''}`.trim(),
          }, { status: 500 });
        }
      } else if (a?.contentBase64) {
        const b64 = String(a.contentBase64).replace(/\s+/g, '');
        if (b64) {
          try { buf = Buffer.from(b64, 'base64'); } catch { buf = null; }
        }
      }
      if (!buf || buf.length === 0) continue;
      mailAttachments.push({ filename, content: buf, contentType });
    }

    // Stamp the campaign as `sending` on first send. Resume requests just
    // re-stamp `startedAt` to whatever was already there.
    if (cdata.status === 'pending' || !cdata.startedAt) {
      const patch = JSON.stringify({
        status: 'sending',
        startedAt: cdata.startedAt || new Date().toISOString(),
      });
      await sql`UPDATE marketing_campaigns SET data = data || ${patch}::jsonb WHERE id = ${id}`;
    }

    // If a fresh "resend to failures only" request comes in, flip the
    // failed rows back to pending so the loop picks them up.
    if (failuresOnly) {
      await sql`
        UPDATE marketing_campaign_recipients
        SET data = data || '{"status":"pending","error":""}'::jsonb
        WHERE campaign_id = ${id} AND data->>'status' = 'failed'
      `;
      const reset = JSON.stringify({ status: 'sending', finishedAt: null });
      await sql`UPDATE marketing_campaigns SET data = data || ${reset}::jsonb WHERE id = ${id}`;
    }

    // Reaper — release any rows stuck in `processing` from a previous,
    // crashed send so they can be claimed again. The cutoff is well past
    // any single send round-trip, so this can't race a live worker.
    const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS).toISOString();
    await sql`
      UPDATE marketing_campaign_recipients
      SET data = data || '{"status":"pending"}'::jsonb
      WHERE campaign_id = ${id}
        AND data->>'status' = 'processing'
        AND COALESCE(data->>'claimedAt', '1970-01-01T00:00:00Z') < ${cutoff}
    `;

    const publicBase = resolvePublicBase(request);
    // Honour anyone who unsubscribed *after* the campaign was queued.
    const optedOut = await getUnsubscribedSet();

    const startedAt = Date.now();
    // Reserve ~30s of safety margin so the response lands before the
    // platform's hard cutoff. The client's send-driver re-issues the POST
    // when we return early.
    const SAFETY_BUDGET_MS = 230_000;
    let processedThisCall = 0;
    let stopped = false;

    while (!stopped && Date.now() - startedAt <= SAFETY_BUDGET_MS) {
      // Atomically claim ONE pending recipient. The SELECT … FOR UPDATE
      // SKIP LOCKED inside the subquery means concurrent /send workers
      // (or accidental duplicate triggers) never grab the same row, so
      // each recipient receives exactly one email.
      const claimedAt = new Date().toISOString();
      const claimedRows = (await sql`
        UPDATE marketing_campaign_recipients
        SET data = data || ${JSON.stringify({ status: 'processing', claimedAt })}::jsonb
        WHERE id = (
          SELECT id FROM marketing_campaign_recipients
          WHERE campaign_id = ${id} AND data->>'status' = 'pending'
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING id, data
      `) as unknown as RecipientDataRow[];

      if (!claimedRows || claimedRows.length === 0) break; // nothing left to do
      const row = claimedRows[0];
      const r = row.data || {};
      const recipientId = row.id;
      const email = String(r.email || '').trim();

      // Skip rows that have unsubscribed mid-campaign — mark `skipped`
      // so totals stay accurate. Failure to persist this update would
      // leave the row stuck in `processing`; we let the error throw so
      // the client knows and the reaper releases it on next batch.
      if (!email || optedOut.has(email.toLowerCase())) {
        const patch = JSON.stringify({
          ...r,
          status: 'skipped',
          error: optedOut.has(email.toLowerCase()) ? 'Recipient unsubscribed' : 'Missing email',
          finishedAt: new Date().toISOString(),
        });
        await sql`UPDATE marketing_campaign_recipients SET data = ${patch}::jsonb WHERE id = ${recipientId}`;
        processedThisCall++;
        continue;
      }

      const ctx2 = {
        name: r.name || '',
        title: r.title || '',
        organisation: r.organisation || '',
        email,
      };
      // Engagement tracking: rewrite every external <a href> to a
      // /api/marketing-track/click proxy and append a 1×1 open pixel.
      // The unsubscribe footer is appended LAST so its link is never
      // rewritten (we don't want a "click" event recorded for opt-outs).
      const trackingCtx = { trackingBaseUrl: publicBase, campaignId: id, recipientId };
      const expandedBody = expandMergeTokens(baseBodyHtml, ctx2);
      const trackedBody = rewriteLinksForTracking(expandedBody, trackingCtx);
      const personalised = trackedBody
        + buildTrackingPixelHtml(trackingCtx)
        + buildUnsubscribeFooterHtml(`${publicBase}/api/marketing-unsubscribe?t=${makeUnsubscribeToken(email)}`);
      const personalisedSubject = expandMergeTokens(subject, ctx2);

      const attempts = Number(r.attempts || 0);
      let result = await sendMarketingBulkEmail({ to: email, subject: personalisedSubject, bodyHtml: personalised, attachments: mailAttachments });

      // Single retry on transient SMTP errors (4xx response codes / network
      // hiccups). Permanent failures (550 etc.) are not retried.
      if (!result.ok) {
        const code = Number(result.error?.responseCode || 0);
        const isTransient = code === 0 || (code >= 400 && code < 500);
        if (isTransient && attempts === 0) {
          await sleep(800);
          result = await sendMarketingBulkEmail({ to: email, subject: personalisedSubject, bodyHtml: personalised, attachments: mailAttachments });
        }
      }

      // Persist the outcome. We deliberately do NOT swallow this error —
      // if the DB write fails after the email went out, the only safe
      // behaviour is to surface the failure so the operator notices,
      // rather than continuing and risk re-sending on resume.
      const patch = result.ok
        ? JSON.stringify({
            ...r,
            status: 'sent',
            attempts: attempts + 1,
            sentAt: new Date().toISOString(),
            messageId: result.messageId || null,
            error: '',
            claimedAt: null,
          })
        : JSON.stringify({
            ...r,
            status: 'failed',
            attempts: attempts + 1,
            finishedAt: new Date().toISOString(),
            error: (result.error?.message || 'Unknown error').slice(0, 300),
            claimedAt: null,
          });
      await sql`UPDATE marketing_campaign_recipients SET data = ${patch}::jsonb WHERE id = ${recipientId}`;
      processedThisCall++;

      // Recompute campaign rolling totals every ~10 sends so the polling
      // composer sees fresh numbers without aggregating per send.
      if (processedThisCall % 10 === 0) {
        await refreshCampaignTotals(id);
      }

      if (throttleMs > 0) {
        const elapsed = Date.now() - startedAt;
        // If sleeping the full throttle would push us past the safety
        // budget, persist the next-allowed timestamp and bow out so the
        // client (or run-due cron) re-issues the POST at the right time.
        // This guarantees the configured per-recipient gap is honoured
        // even for very long delays (5 min, 30 min, 1 hour) that can't
        // fit inside a single 230s batch.
        if (elapsed + throttleMs > SAFETY_BUDGET_MS) {
          const nextAt = new Date(Date.now() + throttleMs).toISOString();
          const patch = JSON.stringify({ nextAllowedAt: nextAt });
          await sql`UPDATE marketing_campaigns SET data = data || ${patch}::jsonb WHERE id = ${id}`;
          stopped = true;
          break;
        }
        await sleep(throttleMs);
      }
    }
    // Once we exit the loop normally (budget hit OR queue drained), clear
    // any stale `nextAllowedAt` so the next /send isn't gated by an old
    // checkpoint that's already in the past.
    if (!stopped) {
      await sql`UPDATE marketing_campaigns SET data = data - 'nextAllowedAt' WHERE id = ${id} AND data ? 'nextAllowedAt'`;
    }

    // We exited because either (a) no pending rows left, or (b) safety
    // budget hit. Either way, refresh totals authoritatively.
    if (Date.now() - startedAt > SAFETY_BUDGET_MS) stopped = true;
    await refreshCampaignTotals(id);

    // Determine remaining work. `pending` is what we'll process next call;
    // `processing` rows we don't count as remaining (a concurrent worker
    // owns them, or the reaper will release them on the next call).
    const stillPending = (await sql`
      SELECT COUNT(*)::int AS c
      FROM marketing_campaign_recipients
      WHERE campaign_id = ${id} AND data->>'status' IN ('pending','processing')
    `) as unknown as CountRow[];
    const remaining = Number(stillPending?.[0]?.c || 0);
    if (remaining === 0) {
      const finalPatch = JSON.stringify({
        status: 'completed',
        finishedAt: new Date().toISOString(),
      });
      await sql`UPDATE marketing_campaigns SET data = data || ${finalPatch}::jsonb WHERE id = ${id}`;
    }

    return NextResponse.json({
      ok: true,
      processed: processedThisCall,
      remaining,
      stopped,
      status: remaining === 0 ? 'completed' : 'sending',
    });
  } catch (err) {
    console.error('marketing-campaigns send error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

async function refreshCampaignTotals(id: string): Promise<void> {
  const rows = (await sql`
    SELECT data->>'status' AS status, COUNT(*)::int AS c
    FROM marketing_campaign_recipients
    WHERE campaign_id = ${id}
    GROUP BY data->>'status'
  `) as unknown as StatusCountRow[];
  let sent = 0, failed = 0, skipped = 0;
  for (const r of rows || []) {
    if (r.status === 'sent') sent = Number(r.c);
    else if (r.status === 'failed') failed = Number(r.c);
    else if (r.status === 'skipped') skipped = Number(r.c);
  }
  const patch = JSON.stringify({ sentCount: sent, failedCount: failed, skippedCount: skipped });
  await sql`UPDATE marketing_campaigns SET data = data || ${patch}::jsonb WHERE id = ${id}`;
}
