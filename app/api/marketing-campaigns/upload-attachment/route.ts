import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import {
  buildAttachmentStorageKey,
  deleteMarketingAttachment,
  sanitiseFilename,
  uploadMarketingAttachmentStream,
} from '@/lib/marketingAttachments';

const STORAGE_KEY_PREFIX = 'marketing-campaigns/attachments/';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Per-file cap. Larger than the previous 8 MB total payload so marketers
// can attach recorded webinars, big PDF catalogues, etc. The campaign row
// itself stays small because only metadata + storage key is persisted.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

// POST /api/marketing-campaigns/upload-attachment
// Accepts a single file via multipart/form-data (field name: "file") and
// streams it into Replit object storage. Returns the metadata + storage
// key the composer should embed in the campaign payload. The campaign
// row never sees the raw bytes, keeping the JSONB row lean.
export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: 'Expected multipart/form-data with a "file" field.' }, { status: 400 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing "file" field.' }, { status: 400 });
    }

    const filename = sanitiseFilename(file.name);
    if (!filename) {
      return NextResponse.json({ error: 'Attachment is missing a filename.' }, { status: 400 });
    }

    const size = file.size;
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: `Attachment "${filename}" is empty.` }, { status: 400 });
    }
    if (size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({
        error: `Attachment "${filename}" exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB per-file limit.`,
      }, { status: 413 });
    }

    const contentType = String(file.type || 'application/octet-stream').slice(0, 120) || 'application/octet-stream';

    // The composer can pre-generate the storage key so it knows which
    // blob to clean up if the user cancels mid-upload (XHR.abort() severs
    // this request before we can return a key). We still validate the
    // shape strictly so a tampered request can only ever target our own
    // attachment prefix with a UUID-style filename.
    const clientKeyRaw = form.get('storageKey');
    const clientKey = typeof clientKeyRaw === 'string' ? clientKeyRaw : '';
    const CLIENT_KEY_RE = /^marketing-campaigns\/attachments\/\d{4}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[^\\/\x00-\x1f<>:"|?*]{1,200}$/;
    const storageKey = clientKey && CLIENT_KEY_RE.test(clientKey)
      ? clientKey
      : buildAttachmentStorageKey(filename);

    // Stream the file body straight into object storage instead of
    // buffering the entire payload in memory. file.stream() is a Web
    // ReadableStream — the helper converts it to a Node Readable.
    await uploadMarketingAttachmentStream(storageKey, file.stream());

    return NextResponse.json({
      filename,
      contentType,
      size,
      storageKey,
    });
  } catch (err) {
    console.error('marketing-campaigns upload-attachment error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

// DELETE /api/marketing-campaigns/upload-attachment
// Body: { storageKey: string }
// Used by the composer to clean up freshly-uploaded blobs that became
// orphans (e.g. one file in a multi-file batch failed, or the marketer
// removed the attachment from the draft before sending). Restricted to
// our own attachment prefix as defence-in-depth so a tampered request
// can't delete arbitrary bucket objects.
export async function DELETE(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    const body = await request.json().catch(() => null) as { storageKey?: unknown } | null;
    const storageKey = typeof body?.storageKey === 'string' ? body.storageKey : '';
    if (!storageKey || !storageKey.startsWith(STORAGE_KEY_PREFIX)) {
      return NextResponse.json({ error: 'Invalid storageKey.' }, { status: 400 });
    }
    await deleteMarketingAttachment(storageKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('marketing-campaigns upload-attachment DELETE error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
