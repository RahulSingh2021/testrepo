import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { purgeUnusedPromoHeaderImages } from '@/lib/whatsappPromoHeaderImagesCleanup';

// Manual / cron-style trigger for the promo header image garbage collector.
// Mirrors the boot-time hook in lib/whatsappPromoWorker.ts so admins (or an
// external scheduler hitting this URL with the admin token) can sweep
// unused rows on demand without restarting the process.
//
// Optional `?days=<N>` overrides the configured retention window for this
// run only. Without it, the env var
// WHATSAPP_PROMO_HEADER_IMAGE_RETENTION_DAYS is used (default 7 days).

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdminSession(req);
  if (unauthorized) return unauthorized;

  const daysParam = req.nextUrl.searchParams.get('days');
  let override: number | null = null;
  if (daysParam) {
    const n = Number(daysParam);
    if (!Number.isFinite(n) || n <= 0 || n > 3650) {
      return NextResponse.json(
        { error: 'days must be a positive integer <= 3650' },
        { status: 400 },
      );
    }
    override = Math.floor(n);
  }

  const result = await purgeUnusedPromoHeaderImages(override);
  if (result.deletedCount > 0) {
    const kb = Math.round(result.deletedBytes / 1024);
    console.log(
      `[whatsapp-promo-header-images] manual purge removed ${result.deletedCount} row(s)` +
        ` (~${kb} KB), retention=${result.thresholdDays}d`,
    );
  }
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  // Allow GET too so a scheduler that only does GETs can trigger it.
  return POST(req);
}
