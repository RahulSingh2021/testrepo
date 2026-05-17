import { Client } from '@replit/object-storage';
import crypto from 'crypto';
import { Readable } from 'stream';

// Replit Object Storage client. Prefers the explicit bucket id wired by
// the platform (DEFAULT_OBJECT_STORAGE_BUCKET_ID) and falls back to the
// SDK's sidecar default-bucket lookup. Passing the id explicitly is more
// robust because in some environments the sidecar default-bucket endpoint
// returns an empty id even though the bucket is provisioned.
let _client: Client | null = null;
const getClient = (): Client => {
  if (!_client) {
    const bucketId = (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '').trim();
    _client = new Client(bucketId ? { bucketId } : undefined);
  }
  return _client;
};

// Storage key layout:
//   marketing-campaigns/attachments/<yyyy-mm>/<uuid>-<sanitised-filename>
// The yyyy-mm prefix keeps listings tidy and lets us garbage-collect old
// blobs by month if we ever need to.
const SAFE_FILENAME_RE = /[\\/\x00-\x1f<>:"|?*]+/g;
export const sanitiseFilename = (raw: unknown): string =>
  String(raw || '').trim().replace(SAFE_FILENAME_RE, '_').slice(0, 200);

export const buildAttachmentStorageKey = (filename: string): string => {
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const safe = sanitiseFilename(filename) || 'attachment';
  return `marketing-campaigns/attachments/${yyyymm}/${crypto.randomUUID()}-${safe}`;
};

export const uploadMarketingAttachment = async (
  storageKey: string,
  contents: Buffer,
): Promise<void> => {
  const res = await getClient().uploadFromBytes(storageKey, contents);
  if (!res.ok) {
    const e = res.error as { message?: string } | string | undefined;
    const errMsg = typeof e === 'string' ? e : (e?.message || 'unknown error');
    throw new Error(`Object storage upload failed: ${errMsg}`);
  }
};

// Streaming upload — avoids buffering the whole payload in memory before
// it hits object storage. Accepts either a Node Readable or a Web
// ReadableStream (e.g. the body of an incoming multipart File).
export const uploadMarketingAttachmentStream = async (
  storageKey: string,
  source: Readable | ReadableStream<Uint8Array>,
): Promise<void> => {
  const nodeStream: Readable =
    source instanceof Readable
      ? source
      : Readable.fromWeb(source as unknown as import('stream/web').ReadableStream<Uint8Array>);
  // The SDK's uploadFromStream resolves once the upload completes and
  // throws on failure; no return value to inspect.
  await getClient().uploadFromStream(storageKey, nodeStream);
};

export const downloadMarketingAttachment = async (storageKey: string): Promise<Buffer> => {
  const res = await getClient().downloadAsBytes(storageKey);
  if (!res.ok) {
    const e = res.error as { message?: string } | string | undefined;
    const errMsg = typeof e === 'string' ? e : (e?.message || 'unknown error');
    throw new Error(`Object storage download failed for ${storageKey}: ${errMsg}`);
  }
  // SDK returns [Buffer]
  const value = res.value as unknown as Buffer | [Buffer];
  return Array.isArray(value) ? value[0] : value;
};

// Copy an existing attachment blob to a freshly-generated key so a
// duplicated campaign owns its own object. Returns the new storage key.
// Each campaign owning its own blob is what lets `deleteMarketingAttachment`
// run safely on campaign delete / draft removal without breaking other
// campaigns that originally shared the same upload.
export const copyMarketingAttachment = async (
  sourceStorageKey: string,
  filename: string,
): Promise<string> => {
  const destKey = buildAttachmentStorageKey(filename);
  const res = await getClient().copy(sourceStorageKey, destKey);
  if (!res.ok) {
    const e = res.error as { message?: string } | string | undefined;
    const errMsg = typeof e === 'string' ? e : (e?.message || 'unknown error');
    throw new Error(`Object storage copy failed for ${sourceStorageKey}: ${errMsg}`);
  }
  return destKey;
};

export const deleteMarketingAttachment = async (storageKey: string): Promise<void> => {
  try {
    await getClient().delete(storageKey, { ignoreNotFound: true });
  } catch (err) {
    // Best-effort — the campaign row is already gone, so an orphaned blob
    // is preferable to surfacing the error to the caller.
    console.warn(`Failed to delete attachment ${storageKey}:`, err);
  }
};
