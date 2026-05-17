import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import crypto from 'crypto';
import { requireAdminSession } from '@/lib/adminAuth';

// Admin-only one-shot backfill: scan training_registrations where
// paymentStatus = 'verified' and myCouponCode is missing, and auto-issue
// a personal Refer & Earn coupon for each (mirrors the same logic that
// runs on new registrations + at payment-verification time).
//
//   POST /api/training-register/backfill-coupons
//     body: { dryRun?: boolean, limit?: number }
//     dryRun=true            → return { ok, candidates, sample } without writing
//     limit=N (default 500)  → cap how many rows are processed in one pass
//
// Idempotent and safe to re-run: rows that already have a coupon (either
// directly on the registration or matching by owner_email+session_id in
// affiliate_coupons) are skipped without creating duplicates. The DB
// unique index on (owner_email, session_id) is the final safety net.

const ensureAffiliateTables = async () => {
  await sql`CREATE TABLE IF NOT EXISTS affiliate_coupons (id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS affiliate_coupons_owner_session_uq
              ON affiliate_coupons ((data->>'owner_email'), (data->>'session_id'))
              WHERE (data->>'owner_email') IS NOT NULL
                AND (data->>'owner_email') <> ''
                AND (data->>'session_id')  IS NOT NULL
                AND (data->>'session_id')  <> ''`;
  } catch {}
};

function buildCouponCode(sessionId: string, email: string, mobile: string): string {
  const emailPart = (email.split('@')[0] || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const mobilePart = mobile.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const sessionPart = sessionId.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-4).padStart(4, '0');
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${emailPart}${mobilePart}${sessionPart}${randomPart}`;
}

type IssueResult = {
  registrationId: string;
  email: string;
  status: 'issued' | 'reused' | 'skipped' | 'error';
  code?: string;
  reason?: string;
};

async function issueOneCoupon(
  registrationId: string,
  sessionId: string,
  reg: any,
  calData: any,
  globalSettings: any,
): Promise<IssueResult> {
  const registrantEmail = String(reg.email || '').trim();
  const registrantPhone = String(reg.mobile || reg.whatsapp || '').trim();
  if (!registrantEmail) {
    return { registrationId, email: '', status: 'skipped', reason: 'no_email' };
  }
  // STRICT POLICY (per user request): only issue a coupon when the session
  // itself has BOTH couponDiscount > 0 AND couponCommission > 0. No global
  // affiliate_settings fallback, no ₹1 floor. Skip the registration entirely
  // if the trainer left either field blank on the calendar.
  const resolvedDiscount   = Number(calData?.couponDiscount)   || 0;
  const resolvedCommission = Number(calData?.couponCommission) || 0;
  if (resolvedDiscount <= 0 || resolvedCommission <= 0) {
    return { registrationId, email: registrantEmail, status: 'skipped', reason: 'no_coupon_amount_on_session' };
  }

  const safeEmail   = registrantEmail.replace(/'/g, "''");
  const safeSession = String(sessionId).replace(/'/g, "''");

  // Activation/expiry — match autoGenerateRegistrantCoupon's window logic.
  const sessionDate = String(calData?.date || reg.sessionDate || '').slice(0, 10);
  const activeFromDate = sessionDate
    ? (() => { const d = new Date(sessionDate + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })()
    : new Date().toISOString().slice(0, 10);
  const expiresAtDate = (() => { const d = new Date(activeFromDate + 'T00:00:00'); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })();

  // Reuse path: a coupon already exists for this owner+session.
  let existingRows: any[] = [];
  try {
    const existingResult = await sql.unsafe(
      `SELECT id, data FROM affiliate_coupons WHERE data->>'owner_email' = '${safeEmail}' AND data->>'session_id' = '${safeSession}' LIMIT 1`,
    );
    existingRows = Array.isArray(existingResult) ? existingResult : [];
  } catch {}

  let finalCode      = '';
  let finalDiscount  = resolvedDiscount;
  let finalCommission = resolvedCommission;
  let finalActiveFrom = activeFromDate;
  let finalExpiresAt  = expiresAtDate;
  let reused = false;

  if (existingRows.length > 0) {
    const d = existingRows[0].data || {};
    finalCode       = String(d.code || '');
    finalActiveFrom = String(d.active_from || activeFromDate);
    finalExpiresAt  = String(d.expires_at  || expiresAtDate);
    finalDiscount   = Number(d.discount_amount)   || resolvedDiscount;
    finalCommission = Number(d.commission_amount) || resolvedCommission;
    reused = true;
  } else {
    // Generate a fresh code, retrying on collision against affiliate_coupons.code.
    let code = buildCouponCode(String(sessionId), registrantEmail, registrantPhone);
    for (let i = 0; i < 10; i++) {
      let checkRows: any[] = [];
      try {
        const safeCode = code.replace(/'/g, "''");
        const check = await sql.unsafe(`SELECT id FROM affiliate_coupons WHERE data->>'code' = '${safeCode}' LIMIT 1`);
        checkRows = Array.isArray(check) ? check : [];
      } catch {}
      if (checkRows.length === 0) break;
      code = buildCouponCode(String(sessionId), registrantEmail, registrantPhone + i);
    }
    const couponId = `afc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const couponData = {
      code,
      owner_id: registrationId,
      owner_name: reg.name || '',
      owner_email: registrantEmail,
      owner_mobile: registrantPhone,
      session_id: sessionId,
      session_title: reg.sessionTitle || calData?.topic || '',
      discount_amount: resolvedDiscount,
      commission_amount: resolvedCommission,
      max_uses: 5,
      current_uses: 0,
      total_commission_earned: 0,
      active: true,
      active_from: activeFromDate,
      expires_at: expiresAtDate,
      created_at: new Date().toISOString(),
      issued_by: 'backfill',
    };
    const couponJson = JSON.stringify(couponData);
    try {
      await sql`INSERT INTO affiliate_coupons (id, data, updated_at) VALUES (${couponId}, ${couponJson}::jsonb, NOW()) ON CONFLICT DO NOTHING`;
    } catch (insertErr) {
      // Unique-index race: another writer beat us. Fall through to re-select.
      console.warn('backfill: insert blocked, re-selecting for', registrantEmail, sessionId, insertErr);
    }
    // Re-select to get the canonical row (whether ours or someone else's).
    try {
      const finalRes = await sql.unsafe(
        `SELECT data FROM affiliate_coupons WHERE data->>'owner_email' = '${safeEmail}' AND data->>'session_id' = '${safeSession}' LIMIT 1`,
      );
      const finalRows = Array.isArray(finalRes) ? finalRes : [];
      if (finalRows.length > 0) {
        const f = finalRows[0].data || {};
        finalCode       = String(f.code || code);
        finalActiveFrom = String(f.active_from || activeFromDate);
        finalExpiresAt  = String(f.expires_at  || expiresAtDate);
        finalDiscount   = Number(f.discount_amount)   || resolvedDiscount;
        finalCommission = Number(f.commission_amount) || resolvedCommission;
      } else {
        finalCode = code;
      }
    } catch {
      finalCode = code;
    }
  }

  if (!finalCode) {
    return { registrationId, email: registrantEmail, status: 'error', reason: 'no_code_generated' };
  }

  // CAS-style update on the registration row — only writes if myCouponCode
  // is still empty so we never clobber a code another path already wrote.
  try {
    const couponPatch = JSON.stringify({
      myCouponCode: finalCode,
      myCouponDiscount: finalDiscount,
      myCouponCommission: finalCommission,
      myCouponActiveFrom: finalActiveFrom,
      myCouponExpiresAt: finalExpiresAt,
      myCouponIssuedAt: new Date().toISOString(),
      myCouponIssuedBy: 'backfill',
    });
    await sql`
      UPDATE training_registrations
      SET data = data || ${couponPatch}::jsonb
      WHERE id = ${registrationId}
        AND (data->>'myCouponCode' IS NULL OR data->>'myCouponCode' = '')
    `;
  } catch (err) {
    console.error('backfill: failed to patch registration row', registrationId, err);
    return { registrationId, email: registrantEmail, status: 'error', reason: 'registration_patch_failed' };
  }

  return {
    registrationId,
    email: registrantEmail,
    status: reused ? 'reused' : 'issued',
    code: finalCode,
  };
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun = body?.dryRun === true;
  const limitRaw = Number(body?.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 5000 ? Math.floor(limitRaw) : 500;

  await ensureAffiliateTables();

  // Pull all verified registrations missing a personal coupon.
  let candidates: any[] = [];
  try {
    const r: any = await sql`
      SELECT id, session_id, data
      FROM training_registrations
      WHERE data->>'paymentStatus' = 'verified'
        AND (data->>'myCouponCode' IS NULL OR data->>'myCouponCode' = '')
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    candidates = Array.isArray(r) ? r : [];
  } catch (err) {
    console.error('backfill-coupons: load candidates failed', err);
    return NextResponse.json({ ok: false, error: 'Failed to load candidates' }, { status: 500 });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      sample: candidates.slice(0, 10).map((row: any) => ({
        id: row.id,
        sessionId: row.session_id,
        name: row?.data?.name || '',
        email: row?.data?.email || '',
      })),
    });
  }

  // Pre-load nothing — strict policy means we never use global settings.
  const globalSettings: any = null;

  const calCache = new Map<string, any>();
  const loadCal = async (sid: string): Promise<any> => {
    if (!sid) return null;
    if (calCache.has(sid)) return calCache.get(sid);
    try {
      const cRes: any = await sql`SELECT data FROM training_calendar WHERE id = ${sid} LIMIT 1`;
      const cRows = Array.isArray(cRes) ? cRes : [];
      const v = cRows[0]?.data || null;
      calCache.set(sid, v);
      return v;
    } catch {
      calCache.set(sid, null);
      return null;
    }
  };

  const results: IssueResult[] = [];
  for (const row of candidates) {
    const reg = row.data || {};
    const sessionId = String(row.session_id || reg.sessionId || '');
    if (!sessionId) {
      results.push({ registrationId: row.id, email: reg.email || '', status: 'skipped', reason: 'no_session' });
      continue;
    }
    const calData = await loadCal(sessionId);
    try {
      const r = await issueOneCoupon(row.id, sessionId, reg, calData, globalSettings);
      results.push(r);
    } catch (err: any) {
      console.error('backfill-coupons: per-row failure', row.id, err);
      results.push({ registrationId: row.id, email: reg.email || '', status: 'error', reason: err?.message || 'exception' });
    }
  }

  const counts = {
    candidates: candidates.length,
    issued: results.filter(r => r.status === 'issued').length,
    reused: results.filter(r => r.status === 'reused').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
  };
  return NextResponse.json({
    ok: true,
    ...counts,
    sample: results.slice(0, 20),
  });
}
