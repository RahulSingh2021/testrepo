import { NextRequest, NextResponse } from 'next/server';
import {
  retryFailedEmails,
  retryRegistrationField,
  RETRY_FIELDS,
  type RetryField,
} from '@/lib/retryFailedEmails';
import { requireAdminSession } from '@/lib/adminAuth';

// Authorize cron-style scans: either a valid admin session OR a matching
// EMAIL_RETRY_CRON_SECRET. Returns null when authorized, or a NextResponse
// with the error to short-circuit.
async function authorizeScan(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = process.env.EMAIL_RETRY_CRON_SECRET;
  if (cronSecret) {
    const provided = request.headers.get('x-cron-secret');
    if (provided && provided === cronSecret) return null;
  }
  // Fall back to admin session auth.
  return requireAdminSession(request);
}

// GET — scan all registrations whose nextRetryAt is due and retry them.
// Designed for use by an external cron (with x-cron-secret) or an admin.
export async function GET(request: NextRequest) {
  const authError = await authorizeScan(request);
  if (authError) return authError;
  try {
    const stats = await retryFailedEmails();
    return NextResponse.json({ ok: true, ...stats });
  } catch (error: any) {
    console.error('retry-emails GET error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

// POST — manual resend for a single registration. Body: { id, field? }
// Admin-only: an admin sends transactional emails to arbitrary recipients
// via this endpoint, so it must require an authenticated admin session.
export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    const { id, field } = body || {};
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const fields: RetryField[] = field && (RETRY_FIELDS as readonly string[]).includes(field)
      ? [field as RetryField]
      : Array.from(RETRY_FIELDS);

    const results: Record<string, any> = {};
    let anyOk = false;
    for (const f of fields) {
      const res = await retryRegistrationField(id, f, { manual: true });
      results[f] = res;
      if (res.ok) anyOk = true;
    }
    return NextResponse.json({ ok: anyOk, results });
  } catch (error: any) {
    console.error('retry-emails POST error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
