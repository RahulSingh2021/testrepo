import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import {
  copyMarketingAttachment,
  deleteMarketingAttachment,
  sanitiseFilename,
} from '@/lib/marketingAttachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORAGE_KEY_PREFIX = 'marketing-campaigns/attachments/';
const MAX_ATTACHMENT_COUNT = 10;

interface IncomingItem {
  filename?: unknown;
  contentType?: unknown;
  size?: unknown;
  storageKey?: unknown;
}

// POST /api/marketing-campaigns/clone-attachments
// Body: { items: [{ filename, contentType, size, storageKey }] }
// Copies each source blob to a fresh storage key so the caller gets a
// set of attachments it owns exclusively (used by the composer's
// duplicate-campaign flow). Single-owner lifecycle is preserved: the
// original campaign keeps its blobs, the new draft gets its own copies.
export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    const body = await request.json().catch(() => null) as { items?: IncomingItem[] } | null;
    const items = Array.isArray(body?.items) ? body!.items : [];
    if (items.length === 0) return NextResponse.json({ items: [] });
    if (items.length > MAX_ATTACHMENT_COUNT) {
      return NextResponse.json({ error: `At most ${MAX_ATTACHMENT_COUNT} attachments per campaign.` }, { status: 400 });
    }

    const cloned: Array<{ filename: string; contentType: string; size: number; storageKey: string }> = [];
    try {
      for (const it of items) {
        const filename = sanitiseFilename(it?.filename);
        const sourceKey = String(it?.storageKey || '').trim();
        if (!filename || !sourceKey || !sourceKey.startsWith(STORAGE_KEY_PREFIX)) {
          return NextResponse.json({ error: 'Invalid attachment payload.' }, { status: 400 });
        }
        const newKey = await copyMarketingAttachment(sourceKey, filename);
        cloned.push({
          filename,
          contentType: String(it?.contentType || 'application/octet-stream').slice(0, 120) || 'application/octet-stream',
          size: Number(it?.size || 0),
          storageKey: newKey,
        });
      }
    } catch (err) {
      // Roll back any copies already made so we don't orphan blobs.
      await Promise.allSettled(cloned.map(a => deleteMarketingAttachment(a.storageKey)));
      console.error('marketing-campaigns clone-attachments error:', err);
      return NextResponse.json({ error: 'Could not clone attachments.' }, { status: 500 });
    }

    return NextResponse.json({ items: cloned });
  } catch (err) {
    console.error('marketing-campaigns clone-attachments error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
