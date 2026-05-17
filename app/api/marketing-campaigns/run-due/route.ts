import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { ensureCampaignTables } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Run-due cron entrypoint ────────────────────────────────────────────────
// Scans `marketing_campaigns` for any row with status='scheduled' and
// sendAt <= now, flips them to status='pending' (so the existing /send
// loop will start sending), and fires off a background /send call for
// each so they actually start moving without waiting for the next cron
// tick.
//
// This endpoint can be hit by:
//   1. An external cron (every minute or two) — preferred for production.
//   2. The in-process poller below (started lazily on first GET of the
//      campaigns list) so a stand-alone Replit deployment without external
//      cron still graduates scheduled campaigns on time.
//
// GET is allowed without admin auth so external cron services (e.g.
// uptime pings) can hit it; the side-effects are bounded (only flips
// rows whose own sendAt has already passed, which the admin set
// themselves), and the actual /send endpoint still requires the admin
// session token so no unauthenticated email sending occurs.

interface DueRow {
  id: string;
  data: Record<string, unknown> | null;
}

function resolveBaseUrl(request: NextRequest): string {
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

export async function runDueCampaigns(opts?: { baseUrl?: string }): Promise<{ scanned: number; promoted: string[]; resumed: string[] }> {
  await ensureCampaignTables();
  const nowIso = new Date().toISOString();
  // Find all scheduled campaigns whose sendAt has passed. Compare ISO
  // strings lexicographically — both sides are emitted in the same
  // YYYY-MM-DDTHH:MM:SS.sssZ format so this is safe and avoids
  // ::timestamptz casts on rows where sendAt may be null/empty.
  // The neon serverless driver can throw "Cannot read properties of null
  // (reading 'map')" when an empty result set is returned for this table —
  // the existing GET /api/marketing-campaigns handler catches the same
  // error silently. We do the same and treat it as zero due rows.
  let rows: DueRow[] = [];
  try {
    rows = (await sql`
      SELECT id, data FROM marketing_campaigns
      WHERE data->>'status' = 'scheduled'
        AND data->>'sendAt' IS NOT NULL
        AND data->>'sendAt' <> ''
        AND data->>'sendAt' <= ${nowIso}
      ORDER BY data->>'sendAt' ASC
      LIMIT 25
    `) as unknown as DueRow[];
    if (!Array.isArray(rows)) rows = [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/reading 'map'/.test(msg)) throw err;
    rows = [];
  }

  const promoted: string[] = [];
  for (const row of rows || []) {
    try {
      const patch = JSON.stringify({ status: 'pending' });
      await sql`UPDATE marketing_campaigns SET data = data || ${patch}::jsonb WHERE id = ${row.id} AND data->>'status' = 'scheduled'`;
      promoted.push(row.id);
    } catch (err) {
      console.error('[run-due] failed to promote', row.id, err);
    }
  }

  // Resume in-flight (`status='sending'`) campaigns whose per-recipient
  // throttle checkpoint (`nextAllowedAt`) has elapsed. Without this, a
  // campaign with a long delay (e.g. 5 min between recipients) that was
  // started by a now-closed browser tab — or by the run-due cron itself
  // for a scheduled blast — would stall forever after the first
  // checkpointed bow-out. The /send loop is idempotent (claims one row
  // at a time with FOR UPDATE SKIP LOCKED), so kicking it again is safe.
  let resumeRows: DueRow[] = [];
  try {
    resumeRows = (await sql`
      SELECT id, data FROM marketing_campaigns
      WHERE data->>'status' = 'sending'
        AND data->>'nextAllowedAt' IS NOT NULL
        AND data->>'nextAllowedAt' <> ''
        AND data->>'nextAllowedAt' <= ${nowIso}
      ORDER BY data->>'nextAllowedAt' ASC
      LIMIT 25
    `) as unknown as DueRow[];
    if (!Array.isArray(resumeRows)) resumeRows = [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/reading 'map'/.test(msg)) throw err;
    resumeRows = [];
  }
  const resumed: string[] = resumeRows.map(r => r.id);

  // Fire-and-forget kick the send loop for each promoted/resumed campaign
  // so they actually start (or resume) sending without waiting for the
  // next cron tick. We deliberately do NOT await these; the /send
  // endpoint is itself a long-poll that can run for ~230s.
  const toKick = [...promoted, ...resumed];
  if (opts?.baseUrl && toKick.length > 0) {
    const adminToken = process.env.ADMIN_CRON_TOKEN || '';
    if (adminToken) {
      for (const cid of toKick) {
        fetch(`${opts.baseUrl}/api/marketing-campaigns/${cid}/send`, {
          method: 'POST',
          headers: { 'x-admin-token': adminToken },
        }).catch(err => console.error('[run-due] kick send failed', cid, err));
      }
    }
  }

  return { scanned: (rows || []).length + resumeRows.length, promoted, resumed };
}

// GET — cron-friendly trigger. No admin auth required (sendAt was set by
// the admin themselves; we only flip the bit at the right time).
export async function GET(request: NextRequest) {
  try {
    const result = await runDueCampaigns({ baseUrl: resolveBaseUrl(request) });
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    console.error('marketing-campaigns run-due GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — admin-gated manual trigger (e.g. "run now" button in the UI).
export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    const result = await runDueCampaigns({ baseUrl: resolveBaseUrl(request) });
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    console.error('marketing-campaigns run-due POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// In-process poller — runs every 60s once the GET handler on
// /api/marketing-campaigns has been hit at least once. Mirrors the
// retryFailedEmails scheduler pattern so a stand-alone Replit deployment
// without external cron still promotes scheduled campaigns on time.
let schedulerStarted = false;
const SCAN_INTERVAL_MS = 60_000;

export function startMarketingScheduleScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log('[Marketing Schedule] Scheduler started — scan every 60s');
  setTimeout(() => {
    runDueCampaigns()
      .then(s => { if (s.promoted.length > 0) console.log('[Marketing Schedule] First scan:', s); })
      .catch(err => console.error('[Marketing Schedule] First scan error:', err));
    setInterval(() => {
      runDueCampaigns()
        .then(s => { if (s.promoted.length > 0) console.log('[Marketing Schedule] Scan:', s); })
        .catch(err => console.error('[Marketing Schedule] Scan error:', err));
    }, SCAN_INTERVAL_MS);
  }, 30_000);
}
