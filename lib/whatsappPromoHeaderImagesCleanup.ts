import sql from '@/lib/db';

// Garbage-collects unused rows from `whatsapp_promo_header_images`.
//
// The upload endpoint (POST /api/whatsapp/promo-header-images) inserts one
// row per file an admin uploads while drafting a Promo Blast. The send
// endpoint (POST /api/whatsapp/multi-training-promo) records the chosen
// header URL on each blast audit row at `data->>'headerImageUrl'`. There
// is no link between the upload and the send beyond that URL, so any rows
// the admin uploaded but never actually used (re-uploads, abandoned
// drafts, accidental clicks) sit in the table forever.
//
// This module deletes rows that are:
//   • older than a configurable threshold (default 7 days), AND
//   • NOT referenced by the `headerImageUrl` of any past blast audit row.
//
// Recently-uploaded rows are always kept so an in-progress draft that
// hasn't been sent yet is never yanked out from under the admin.
//
// Threshold can be overridden via the env var
// WHATSAPP_PROMO_HEADER_IMAGE_RETENTION_DAYS (positive integer).

const DEFAULT_RETENTION_DAYS = 7;

function resolveThresholdDays(override?: number | null): number {
  if (override != null && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }
  const raw = process.env.WHATSAPP_PROMO_HEADER_IMAGE_RETENTION_DAYS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return DEFAULT_RETENTION_DAYS;
}

export interface PromoHeaderImageCleanupResult {
  thresholdDays: number;
  deletedCount: number;
  deletedBytes: number;
  deletedIds: string[];
}

// Deletes orphan rows older than the threshold. Returns counts so callers
// (boot-time hook, manual admin endpoint) can log/expose the result.
// Best-effort: missing tables are treated as "nothing to do".
export async function purgeUnusedPromoHeaderImages(
  thresholdDaysOverride?: number | null,
): Promise<PromoHeaderImageCleanupResult> {
  const thresholdDays = resolveThresholdDays(thresholdDaysOverride);
  const empty: PromoHeaderImageCleanupResult = {
    thresholdDays,
    deletedCount: 0,
    deletedBytes: 0,
    deletedIds: [],
  };

  // If the images table doesn't exist yet there's nothing to do; bail
  // before issuing the DELETE so we don't error on fresh installs.
  try {
    const exists: any = await sql`SELECT to_regclass('public.whatsapp_promo_header_images') AS t`;
    const t = Array.isArray(exists) && exists[0] ? exists[0].t : null;
    if (!t) return empty;
  } catch {
    return empty;
  }

  // The audit table is created lazily on first send. If it isn't there
  // yet, NO rows are referenced, so the safe behaviour is to still apply
  // the age threshold and delete anything older than that.
  let auditExists = false;
  try {
    const exists: any = await sql`SELECT to_regclass('public.whatsapp_multi_training_promos') AS t`;
    auditExists = !!(Array.isArray(exists) && exists[0] && exists[0].t);
  } catch {
    auditExists = false;
  }

  try {
    let rows: any;
    if (auditExists) {
      // Match the URL by suffix. The upload endpoint returns
      // `/api/whatsapp/promo-header-images/<id>`; the send endpoint stores
      // that exact string on the audit row. Suffix match (`%/<id>`) keeps
      // us robust if the URL was ever absolutised before being saved.
      rows = await sql`
        DELETE FROM whatsapp_promo_header_images h
        WHERE h.created_at < NOW() - (${thresholdDays} || ' days')::interval
          AND NOT EXISTS (
            SELECT 1
            FROM whatsapp_multi_training_promos b
            WHERE b.data->>'headerImageUrl' LIKE '%/promo-header-images/' || h.id
          )
        RETURNING id, COALESCE(byte_size, 0) AS byte_size
      `;
    } else {
      rows = await sql`
        DELETE FROM whatsapp_promo_header_images h
        WHERE h.created_at < NOW() - (${thresholdDays} || ' days')::interval
        RETURNING id, COALESCE(byte_size, 0) AS byte_size
      `;
    }
    const arr: Array<{ id: string; byte_size: number }> = Array.isArray(rows) ? rows : [];
    const deletedBytes = arr.reduce((s, r) => s + (Number(r.byte_size) || 0), 0);
    const deletedIds = arr.map(r => String(r.id));
    return {
      thresholdDays,
      deletedCount: arr.length,
      deletedBytes,
      deletedIds,
    };
  } catch (err) {
    console.error('[whatsapp-promo-header-images] purge failed', err);
    return empty;
  }
}

// Boot-time hook. Runs the purge once per Node process and logs a single
// summary line so we have an audit trail of what was removed.
let bootPurgeStarted = false;
export async function runPromoHeaderImageBootPurge(): Promise<void> {
  if (bootPurgeStarted) return;
  bootPurgeStarted = true;
  try {
    const result = await purgeUnusedPromoHeaderImages();
    if (result.deletedCount > 0) {
      const kb = Math.round(result.deletedBytes / 1024);
      console.log(
        `[whatsapp-promo-header-images] purged ${result.deletedCount} unused image row(s)` +
          ` (~${kb} KB), retention=${result.thresholdDays}d, ids=[${result.deletedIds.slice(0, 20).join(',')}` +
          `${result.deletedIds.length > 20 ? ',…' : ''}]`,
      );
    }
  } catch (err) {
    console.error('[whatsapp-promo-header-images] boot purge failed', err);
  }
}
