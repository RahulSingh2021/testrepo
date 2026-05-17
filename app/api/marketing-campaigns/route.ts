import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import crypto from 'crypto';
import { requireAdminSession } from '@/lib/adminAuth';
import { sanitizeMarketingHtml } from '@/lib/marketingHtml';
import { ensureUnsubscribeSchema, getUnsubscribedSet } from '@/lib/marketingUnsubscribe';
import { sanitiseFilename } from '@/lib/marketingAttachments';
import { startMarketingScheduleScheduler } from './run-due/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Marketing Campaigns store ──────────────────────────────────────────────
// Two JSONB tables persist every bulk-email blast:
//   marketing_campaigns           — one row per campaign (subject, body,
//                                   totals, timestamps, status).
//   marketing_campaign_recipients — one row per recipient (status, attempts,
//                                   error message, sentAt).
// The send loop in /api/marketing-campaigns/[id]/send walks the recipient
// rows sequentially and updates them in place so the composer's progress
// poll always reflects the truth even if the loop is interrupted.

export const ensureCampaignTables = async () => {
  await sql`CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mkt_camp_recip_campaign ON marketing_campaign_recipients(campaign_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mkt_camp_recip_status ON marketing_campaign_recipients(campaign_id, (data->>'status'))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mkt_camp_created ON marketing_campaigns(created_at DESC)`;
  await ensureUnsubscribeSchema();
};

interface IncomingRecipient {
  email?: string;
  name?: string;
  title?: string;
  organisation?: string;
}

interface IncomingAttachment {
  filename?: string;
  contentType?: string;
  size?: number;
  storageKey?: string;
  // Legacy: pre-object-storage campaigns persisted base64 inline. New
  // payloads must use storageKey; this is only retained so we can read
  // back historical rows.
  contentBase64?: string;
}

// Per-file cap (kept in sync with the upload endpoint). Total per campaign
// is bounded by MAX_ATTACHMENT_COUNT * MAX_ATTACHMENT_BYTES = 250 MB, but
// in practice marketers stay well under that.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB per file
const MAX_ATTACHMENT_COUNT = 10;
const STORAGE_KEY_PREFIX = 'marketing-campaigns/attachments/';

// Stored on the campaign row — pure metadata, no file bytes. The file
// itself lives in object storage at `storageKey` and is fetched on demand
// by the send loop.
export interface StoredAttachment {
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
}

function sanitiseAttachments(raw: unknown): { ok: true; attachments: StoredAttachment[]; totalBytes: number } | { ok: false; error: string } {
  if (raw == null) return { ok: true, attachments: [], totalBytes: 0 };
  if (!Array.isArray(raw)) return { ok: false, error: 'Attachments must be an array.' };
  if (raw.length > MAX_ATTACHMENT_COUNT) {
    return { ok: false, error: `At most ${MAX_ATTACHMENT_COUNT} attachments allowed per campaign.` };
  }
  const out: StoredAttachment[] = [];
  let total = 0;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i] as IncomingAttachment;
    const filename = sanitiseFilename(a?.filename);
    if (!filename) return { ok: false, error: `Attachment ${i + 1} is missing a filename.` };
    const contentType = String(a?.contentType || 'application/octet-stream').trim().slice(0, 120);
    const size = Number(a?.size);
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, error: `Attachment "${filename}" has an invalid size.` };
    }
    if (size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: `Attachment "${filename}" exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB per-file limit.` };
    }
    const storageKey = String(a?.storageKey || '').trim();
    if (!storageKey || !storageKey.startsWith(STORAGE_KEY_PREFIX)) {
      // Defence in depth: only accept storage keys produced by our own
      // upload endpoint so a tampered payload can't make the send loop
      // download an arbitrary path from the bucket.
      return { ok: false, error: `Attachment "${filename}" has an invalid storage key. Please re-upload it.` };
    }
    total += size;
    out.push({ filename, contentType, size, storageKey });
  }
  return { ok: true, attachments: out, totalBytes: total };
}

// Returns the metadata-only view of attachments. Old campaigns that still
// have a base64 blob get their `contentBase64` stripped so the wire payload
// stays small for both shapes.
export function publicAttachmentMeta(att: Array<StoredAttachment | IncomingAttachment> | undefined): Array<{ filename: string; contentType: string; size: number }> {
  if (!Array.isArray(att)) return [];
  return att.map(a => ({
    filename: String(a.filename || ''),
    contentType: String(a.contentType || 'application/octet-stream'),
    size: Number(a.size || 0),
  }));
}

interface CampaignSummaryRow {
  id: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

const lc = (s: unknown) => String(s ?? '').trim().toLowerCase();
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);

// GET — campaign history (newest first).
export async function GET(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureCampaignTables();
    // Start the in-process scheduler lazily so a stand-alone Replit
    // deployment without external cron still graduates scheduled campaigns.
    startMarketingScheduleScheduler();
    const rows = (await sql`SELECT id, data, created_at FROM marketing_campaigns ORDER BY created_at DESC LIMIT 200`) as unknown as CampaignSummaryRow[];
    const items = (rows || []).map(r => {
      const data = (r.data || {}) as Record<string, unknown>;
      const { attachments, ...rest } = data;
      return {
        id: r.id,
        createdAt: r.created_at,
        ...rest,
        // Strip base64 payload — history list only shows attachment names/sizes.
        attachments: publicAttachmentMeta(attachments as StoredAttachment[] | undefined),
      };
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error('marketing-campaigns GET error:', err);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

// POST — create a new campaign. Server dedups recipients (case-insensitive
// email), drops invalid + unsubscribed addresses, sanitises the body HTML,
// and queues one `pending` row per recipient.
export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureCampaignTables();
    const body = await request.json().catch(() => ({}));
    const subject = String(body?.subject || '').trim();
    const bodyHtml = sanitizeMarketingHtml(body?.bodyHtml);
    const recipientsRaw: IncomingRecipient[] = Array.isArray(body?.recipients) ? body.recipients : [];
    // Allow 0 (≈400ms minimum on the send loop) up to 60 minutes between
    // recipients so marketers can pace large blasts to dodge spam filters
    // or honour deliverability windows. The send loop persists a
    // `nextAllowedAt` checkpoint when a long delay can't fit in a single
    // 230s safety budget so the spacing is honoured across batches.
    const throttleMs = Math.max(0, Math.min(60 * 60_000, Number(body?.throttleMs) || 400));

    const attachmentsResult = sanitiseAttachments(body?.attachments);
    if (!attachmentsResult.ok) {
      return NextResponse.json({ error: attachmentsResult.error }, { status: 400 });
    }
    // Single-owner lifecycle: each campaign owns the storage keys it was
    // POSTed with. The upload endpoint mints a fresh key per uploaded
    // file, and duplication uses /clone-attachments to mint new keys, so
    // distinct campaigns never share a key. No copy is needed here.
    const attachments = attachmentsResult.attachments;

    // Optional scheduling: if `sendAt` (ISO string) is provided and parses to
    // a future timestamp, the campaign is created with status='scheduled' and
    // the run-due cron / poller will flip it to 'pending' at the right moment.
    // Anything in the past or unparseable is treated as "send immediately".
    let sendAt: string | null = null;
    let isScheduled = false;
    if (body?.sendAt) {
      const t = new Date(String(body.sendAt));
      if (!isNaN(t.getTime()) && t.getTime() > Date.now() + 30_000) {
        sendAt = t.toISOString();
        isScheduled = true;
      }
    }

    if (!subject) return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
    if (!bodyHtml || bodyHtml.replace(/<[^>]+>/g, '').trim().length === 0) {
      return NextResponse.json({ error: 'Email body is empty.' }, { status: 400 });
    }
    if (recipientsRaw.length === 0) {
      return NextResponse.json({ error: 'No recipients provided.' }, { status: 400 });
    }
    if (recipientsRaw.length > 10000) {
      return NextResponse.json({ error: 'Maximum 10,000 recipients per campaign.' }, { status: 400 });
    }

    const optedOut = await getUnsubscribedSet();
    const seen = new Set<string>();
    const queued: IncomingRecipient[] = [];
    let invalid = 0;
    let optedOutCount = 0;
    for (const r of recipientsRaw) {
      const email = lc(r?.email);
      if (!email || !isEmail(email)) { invalid++; continue; }
      if (seen.has(email)) continue;
      seen.add(email);
      if (optedOut.has(email)) { optedOutCount++; continue; }
      queued.push({
        email,
        name: String(r?.name || '').trim(),
        title: String(r?.title || '').trim(),
        organisation: String(r?.organisation || '').trim(),
      });
    }

    if (queued.length === 0) {
      return NextResponse.json({ error: 'No valid, non-unsubscribed recipients to send to.' }, { status: 400 });
    }

    const campaignId = crypto.randomUUID();
    const campaignData = {
      subject,
      bodyHtml,
      throttleMs,
      status: (isScheduled ? 'scheduled' : 'pending') as 'scheduled' | 'pending',
      sendAt,
      totalRecipients: queued.length,
      sentCount: 0,
      failedCount: 0,
      skippedInvalid: invalid,
      skippedUnsubscribed: optedOutCount,
      startedAt: null as string | null,
      finishedAt: null as string | null,
      // Attachments are stored as metadata + storage keys only; the file
      // bytes live in object storage and are fetched on demand by the
      // send loop. This keeps the campaign row small even for ~25 MB files.
      attachments,
      attachmentsTotalBytes: attachmentsResult.totalBytes,
    };

    // Insert the campaign + all recipients atomically using neon's
    // non-interactive transaction (single HTTP round-trip per chunk).
    // Either every recipient lands or nothing does, so history can
    // never show a half-populated campaign with a misleading total.
    // Chunked at 500 rows/batch to stay within neon's per-transaction
    // payload ceiling for very large recipient lists.
    try {
      const campaignInsert = sql`INSERT INTO marketing_campaigns (id, data) VALUES (${campaignId}, ${JSON.stringify(campaignData)}::jsonb)`;
      const recipientInserts = queued.map(r => {
        const id = crypto.randomUUID();
        const data = JSON.stringify({
          email: r.email,
          name: r.name || '',
          title: r.title || '',
          organisation: r.organisation || '',
          status: 'pending',
          attempts: 0,
        });
        return sql`INSERT INTO marketing_campaign_recipients (id, campaign_id, data)
                   VALUES (${id}, ${campaignId}, ${data}::jsonb)`;
      });
      const CHUNK = 500;
      // First chunk includes the campaign row so the FK-style relationship
      // (recipients.campaign_id → campaigns.id) commits together.
      const firstBatch = [campaignInsert, ...recipientInserts.slice(0, CHUNK)];
      await sql.transaction(firstBatch);
      for (let i = CHUNK; i < recipientInserts.length; i += CHUNK) {
        await sql.transaction(recipientInserts.slice(i, i + CHUNK));
      }
    } catch (insertErr) {
      console.error('marketing-campaigns transactional insert failed; rolling back:', insertErr);
      // First-batch failure: nothing committed. Subsequent-batch failure:
      // earlier chunks already committed; clean them up so we don't leave
      // a partially-populated campaign visible in history.
      try { await sql`DELETE FROM marketing_campaign_recipients WHERE campaign_id = ${campaignId}`; } catch {}
      try { await sql`DELETE FROM marketing_campaigns WHERE id = ${campaignId}`; } catch {}
      return NextResponse.json({ error: 'Failed to queue all recipients; campaign rolled back.' }, { status: 500 });
    }

    const { attachments: _attBlob, ...publicCampaignData } = campaignData;
    return NextResponse.json({
      id: campaignId,
      ...publicCampaignData,
      attachments: publicAttachmentMeta(attachments),
    });
  } catch (err) {
    console.error('marketing-campaigns POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
