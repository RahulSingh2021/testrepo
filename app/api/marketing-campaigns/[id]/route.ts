import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { ensureCampaignTables, publicAttachmentMeta } from '../route';
import {
  getCampaignEngagementByRecipient,
  getCampaignEngagementTotals,
  getCampaignClicksByUrl,
  getCampaignClicksByDay,
} from '@/lib/marketingEvents';
import { deleteMarketingAttachment } from '@/lib/marketingAttachments';

interface StoredAttachmentLike {
  filename: string;
  contentType: string;
  size: number;
  storageKey?: string;
  contentBase64?: string;
}

// Replace the heavy `attachments` array (which holds full base64) with a
// lean metadata-only version so the composer/poll endpoints never re-download
// the file payload. The send route reads attachments straight from the DB,
// not from these GET responses.
function stripAttachmentBlobs(data: Record<string, unknown> | null): Record<string, unknown> {
  if (!data) return {};
  const { attachments, ...rest } = data;
  return {
    ...rest,
    attachments: publicAttachmentMeta(attachments as StoredAttachmentLike[] | undefined),
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CampaignRow {
  id: string;
  data: Record<string, unknown> | null;
  created_at: string;
}
interface RecipientRow {
  id: string;
  data: Record<string, unknown> | null;
}
type RecipientStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';

// GET /api/marketing-campaigns/[id]
// Returns the campaign + per-recipient status. The composer polls this
// endpoint while the send loop runs to render the live progress bar and
// the final summary table.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureCampaignTables();
    const { id } = await ctx.params;
    const camp = (await sql`SELECT id, data, created_at FROM marketing_campaigns WHERE id = ${id} LIMIT 1`) as unknown as CampaignRow[];
    if (!Array.isArray(camp) || camp.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    // ?summary=1 returns counts only (no per-recipient list). Used by
    // the live progress poll loop on large campaigns (up to 10k recipients)
    // to keep payloads small. Omit it (or pass ?summary=0) to get the full
    // recipient detail for history drilldown / CSV export.
    const url = new URL(request.url);
    const summaryOnly = url.searchParams.get('summary') === '1';
    // ?include=attachments returns the full base64 payload for each
    // attachment so the composer can pre-fill them when duplicating a
    // past campaign. Default responses still strip the blobs to keep
    // poll payloads small.
    const includeAttachments = url.searchParams.get('include') === 'attachments';

    const counts: Record<RecipientStatus, number> = {
      pending: 0, processing: 0, sent: 0, failed: 0, skipped: 0,
    };

    if (includeAttachments) {
      // Side-effect-free: returns the campaign row including attachment
      // metadata + the original storage keys. Callers that want their
      // own copy of the blobs (e.g. the composer's duplicate flow) must
      // explicitly POST to /api/marketing-campaigns/clone-attachments;
      // GET never mutates object storage.
      const data = (camp[0].data || {}) as Record<string, unknown>;
      return NextResponse.json({
        id: camp[0].id,
        createdAt: camp[0].created_at,
        ...data,
      });
    }

    if (summaryOnly) {
      const [grouped, engagementTotals, clicksByUrl, clicksByDay] = await Promise.all([
        sql`
          SELECT COALESCE(data->>'status','pending') AS status, COUNT(*)::int AS n
          FROM marketing_campaign_recipients
          WHERE campaign_id = ${id}
          GROUP BY 1
        ` as unknown as Promise<Array<{ status: string; n: number }>>,
        getCampaignEngagementTotals(id),
        getCampaignClicksByUrl(id),
        getCampaignClicksByDay(id),
      ]);
      for (const row of grouped || []) {
        const k = row.status as RecipientStatus;
        if (k in counts) counts[k] = row.n;
      }
      return NextResponse.json({
        id: camp[0].id,
        createdAt: camp[0].created_at,
        ...stripAttachmentBlobs(camp[0].data),
        counts,
        engagement: engagementTotals,
        clicksByUrl,
        clicksByDay,
      });
    }

    const [recips, engagementMap, engagementTotals, clicksByUrl, clicksByDay] = await Promise.all([
      sql`SELECT id, data FROM marketing_campaign_recipients WHERE campaign_id = ${id} ORDER BY created_at ASC` as unknown as Promise<RecipientRow[]>,
      getCampaignEngagementByRecipient(id),
      getCampaignEngagementTotals(id),
      getCampaignClicksByUrl(id),
      getCampaignClicksByDay(id),
    ]);
    const recipients = (recips || []).map(r => {
      const eng = engagementMap.get(r.id);
      return {
        id: r.id,
        ...(r.data || {}),
        opened: eng?.opened || false,
        openCount: eng?.openCount || 0,
        firstOpenedAt: eng?.firstOpenedAt || null,
        clicked: eng?.clicked || false,
        clickCount: eng?.clickCount || 0,
        firstClickedAt: eng?.firstClickedAt || null,
      };
    });
    for (const r of recipients) {
      const k = String((r as { status?: string }).status || 'pending') as RecipientStatus;
      if (k in counts) counts[k] += 1;
    }
    return NextResponse.json({
      id: camp[0].id,
      createdAt: camp[0].created_at,
      ...stripAttachmentBlobs(camp[0].data),
      counts,
      engagement: engagementTotals,
      clicksByUrl,
      clicksByDay,
      recipients,
    });
  } catch (err) {
    console.error('marketing-campaigns GET[id] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH — used to reschedule or cancel a campaign that has not started yet.
// Body shape:
//   { sendAt: '2026-05-10T09:00:00.000Z' }  → reschedule a 'scheduled' campaign
//   { cancel: true }                        → cancel a 'scheduled' campaign
// Both operations are only valid while the campaign is still in 'scheduled'
// state (i.e. before the run-due cron has flipped it to 'pending'/'sending').
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureCampaignTables();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const camp = (await sql`SELECT data FROM marketing_campaigns WHERE id = ${id} LIMIT 1`) as unknown as CampaignRow[];
    if (!Array.isArray(camp) || camp.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const cdata = (camp[0].data || {}) as Record<string, unknown>;
    if (cdata.status !== 'scheduled' && cdata.status !== 'cancelled') {
      return NextResponse.json({ error: 'Only scheduled campaigns can be rescheduled or cancelled.' }, { status: 400 });
    }

    if (body?.cancel === true) {
      const patch = JSON.stringify({ status: 'cancelled', sendAt: null, finishedAt: new Date().toISOString() });
      await sql`UPDATE marketing_campaigns SET data = data || ${patch}::jsonb WHERE id = ${id}`;
      return NextResponse.json({ ok: true, status: 'cancelled' });
    }

    if (body?.sendAt) {
      const t = new Date(String(body.sendAt));
      if (isNaN(t.getTime()) || t.getTime() <= Date.now() + 30_000) {
        return NextResponse.json({ error: 'sendAt must be at least 30 seconds in the future.' }, { status: 400 });
      }
      const patch = JSON.stringify({ status: 'scheduled', sendAt: t.toISOString(), finishedAt: null });
      await sql`UPDATE marketing_campaigns SET data = data || ${patch}::jsonb WHERE id = ${id}`;
      return NextResponse.json({ ok: true, status: 'scheduled', sendAt: t.toISOString() });
    }

    return NextResponse.json({ error: 'Provide either { cancel: true } or { sendAt }.' }, { status: 400 });
  } catch (err) {
    console.error('marketing-campaigns PATCH error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — admin can purge a campaign + its recipient rows. The send loop
// honours deleted rows (no-op) so even an in-flight campaign can be cancelled.
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureCampaignTables();
    const { id } = await ctx.params;
    // Best-effort cleanup of engagement events. Wrapped in try/catch
    // because the events table may not yet exist for very old campaigns
    // created before tracking was added — we don't want that to block
    // deletion of the campaign + recipient rows.
    try { await sql`DELETE FROM marketing_campaign_events WHERE campaign_id = ${id}`; } catch {}
    // Best-effort: remove the attachment blobs from object storage before
    // dropping the campaign row so we don't orphan files in the bucket.
    // Failures are logged but never block the DB delete — better to leak
    // a few KB than to leave a phantom campaign in history.
    try {
      const camp = (await sql`SELECT data FROM marketing_campaigns WHERE id = ${id} LIMIT 1`) as unknown as Array<{ data: Record<string, unknown> | null }>;
      const atts = (camp?.[0]?.data?.attachments as StoredAttachmentLike[] | undefined) || [];
      await Promise.allSettled(
        atts.filter(a => !!a.storageKey).map(a => deleteMarketingAttachment(a.storageKey!)),
      );
    } catch (err) {
      console.warn('marketing-campaigns DELETE: attachment cleanup failed:', err);
    }
    await sql`DELETE FROM marketing_campaign_recipients WHERE campaign_id = ${id}`;
    await sql`DELETE FROM marketing_campaigns WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('marketing-campaigns DELETE error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
