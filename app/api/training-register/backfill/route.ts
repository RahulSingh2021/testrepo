import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import {
  sendFreeRegistrationConfirmation,
  sendPaidRegistrationPending,
} from '@/lib/sendEmail';

const MAX_PER_CALL = 200;

type RegRow = { id: string; session_id: string; data: any; created_at: string };

async function loadCandidates(idsFilter?: string[]): Promise<{ regs: RegRow[]; sessions: Map<string, any> }> {
  const todayIso = new Date().toISOString().slice(0, 10);
  let regResult: any;
  try {
    regResult = await sql`SELECT id, session_id, data, created_at FROM training_registrations
      WHERE (data->>'emailSentAt') IS NULL
        AND (data->>'emailSentAtFailedAt') IS NULL
        AND (data->>'email') IS NOT NULL
        AND length(data->>'email') > 3
      ORDER BY created_at ASC`;
  } catch { regResult = null; }
  const regRows: RegRow[] = Array.isArray(regResult) ? regResult : [];

  const sessionIds = Array.from(new Set(regRows.map(r => r.session_id))).filter(Boolean);
  const sessions = new Map<string, any>();
  if (sessionIds.length > 0) {
    try {
      const calRes = await sql`SELECT id, data FROM training_calendar WHERE id = ANY(${sessionIds as any})`;
      const calRows = Array.isArray(calRes) ? calRes : [];
      for (const c of calRows) sessions.set(c.id, c.data || {});
    } catch {}
  }

  const filtered = regRows.filter(r => {
    if (idsFilter && idsFilter.length > 0 && !idsFilter.includes(r.id)) return false;
    const cal = sessions.get(r.session_id) || {};
    const sessionDate: string = (cal.date || r.data?.sessionDate || '').toString().slice(0, 10);
    if (!sessionDate) return false;
    return sessionDate >= todayIso;
  });

  return { regs: filtered, sessions };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const countOnlyParam = searchParams.get('countOnly');
    const countOnly = countOnlyParam === '1' || countOnlyParam === 'true';

    const { regs, sessions } = await loadCandidates();

    if (countOnly) {
      return NextResponse.json({ count: regs.length });
    }

    const items = regs.map(r => {
      const cal = sessions.get(r.session_id) || {};
      const isPaid = !!(r.data?.utrNumber || r.data?.paymentStatus);
      return {
        id: r.id,
        sessionId: r.session_id,
        createdAt: r.created_at,
        name: r.data?.name || '',
        email: r.data?.email || '',
        whatsapp: r.data?.whatsapp || r.data?.mobile || '',
        sessionTitle: r.data?.sessionTitle || cal.topic || '',
        sessionDate: cal.date || r.data?.sessionDate || '',
        startTime: cal.startTime || '',
        endTime: cal.endTime || '',
        mode: cal.mode || '',
        location: cal.location || '',
        trainer: cal.trainer || '',
        utrNumber: r.data?.utrNumber || '',
        template: isPaid ? 'paid_registration_pending' : 'free_registration_confirmation',
      };
    });
    return NextResponse.json({ items, count: items.length, maxPerCall: MAX_PER_CALL });
  } catch (error) {
    console.error('training-register backfill GET error:', error);
    return NextResponse.json({ items: [], count: 0, error: 'Failed to load backfill candidates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const requestedIds: string[] | undefined = Array.isArray(body?.ids) && body.ids.length > 0
      ? body.ids.map((x: any) => String(x))
      : undefined;

    const { regs, sessions } = await loadCandidates(requestedIds);

    if (regs.length === 0) {
      return NextResponse.json({ attempted: 0, sent: 0, failed: 0, skipped: 0, count: 0, results: [] });
    }

    const slice = regs.slice(0, MAX_PER_CALL);
    const truncated = regs.length > slice.length;

    const results: { id: string; ok: boolean; template: string; error?: string }[] = [];
    let sent = 0;
    let failed = 0;

    for (const r of slice) {
      const cal = sessions.get(r.session_id) || {};
      const data = r.data || {};
      const isPaid = !!(data.utrNumber || data.paymentStatus);
      const template = isPaid ? 'paid_registration_pending' : 'free_registration_confirmation';
      const recipient = String(data.email || '');

      const emailParams = {
        to:              recipient,
        name:            data.name || '',
        sessionTitle:    data.sessionTitle || cal.topic || '',
        sessionDate:     cal.date || data.sessionDate || '',
        sessionTime:     cal.startTime
                          ? `${cal.startTime}${cal.endTime ? ' – ' + cal.endTime : ''}`
                          : '',
        sessionMode:     cal.mode || '',
        sessionLocation: cal.location || '',
        trainer:         cal.trainer || '',
      };

      let result: { ok: boolean; error?: { code?: string; responseCode?: number; message: string } };
      try {
        if (isPaid) {
          result = await sendPaidRegistrationPending({
            ...emailParams,
            utrNumber:        data.utrNumber || '',
            courseFee:        Number(cal.courseFee || cal.fee) || undefined,
            couponDiscount:   data.myCouponDiscount   || null,
            couponCommission: data.myCouponCommission || null,
            couponMaxUses:    5,
          });
        } else {
          result = await sendFreeRegistrationConfirmation({
            ...emailParams,
            myCouponCode:     data.myCouponCode       || null,
            couponDiscount:   data.myCouponDiscount    || null,
            couponCommission: data.myCouponCommission  || null,
            couponActiveFrom: data.myCouponActiveFrom  || null,
            couponExpiresAt:  data.myCouponExpiresAt   || null,
            couponMaxUses:    5,
          });
        }
      } catch (err: any) {
        result = { ok: false, error: { message: err?.message || 'send threw' } };
      }

      const now = new Date().toISOString();
      try {
        if (result?.ok) {
          const patch = JSON.stringify({
            emailSentAt: now,
            emailSentAtFailedAt: null,
            emailSentAtError: null,
            emailBackfilledAt: now,
          });
          await sql`UPDATE training_registrations SET data = data || ${patch}::jsonb WHERE id = ${r.id}`;
          sent++;
          results.push({ id: r.id, ok: true, template });
        } else {
          const patch = JSON.stringify({
            emailSentAtFailedAt: now,
            emailSentAtError: {
              code: result?.error?.code ?? null,
              responseCode: result?.error?.responseCode ?? null,
              message: (result?.error?.message || 'unknown').slice(0, 500),
              template,
              recipient,
            },
          });
          await sql`UPDATE training_registrations SET data = data || ${patch}::jsonb WHERE id = ${r.id}`;
          failed++;
          results.push({ id: r.id, ok: false, template, error: result?.error?.message || 'unknown' });
        }
      } catch (dbErr) {
        failed++;
        results.push({ id: r.id, ok: false, template, error: 'persist failed' });
      }
    }

    let count = 0;
    try {
      const { regs: remaining } = await loadCandidates();
      count = remaining.length;
    } catch {}

    return NextResponse.json({
      attempted: slice.length,
      sent,
      failed,
      remaining: truncated ? regs.length - slice.length : 0,
      maxPerCall: MAX_PER_CALL,
      count,
      results,
    });
  } catch (error) {
    console.error('training-register backfill POST error:', error);
    return NextResponse.json({ error: 'Failed to backfill emails' }, { status: 500 });
  }
}
