import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// Admin-only one-shot cleanup for Refer & Earn coupons that were
// auto-issued by the OLD fallback chain (global affiliate_settings %
// of fee, with a ₹1 floor) for sessions whose training_calendar entry
// never had couponDiscount/couponCommission filled in.
//
// New strict policy (already shipped) refuses to issue these coupons
// at all going forward — this endpoint cleans up the legacy rows.
//
//   POST /api/training-register/purge-wrong-coupons
//     body: { dryRun?: boolean }
//
//   dryRun=true  → return { ok, candidates, sample } without writing.
//   dryRun=false → delete the affiliate_coupons rows AND strip the
//                  myCoupon* fields from the matching training_registrations
//                  rows so the registrant cards stop showing dead codes.
//
// Safety: we ONLY delete coupons whose current_uses = 0. Any coupon that
// has already been redeemed (even once) is left alone so we never destroy
// a real referral history. Audit affiliate_credits separately if needed.

type WrongCoupon = {
  couponId: string;
  code: string;
  sessionId: string;
  sessionTitle: string | null;
  ownerEmail: string;
  ownerName: string | null;
  discount: number;
  commission: number;
  currentUses: number;
};

async function findWrongCoupons(): Promise<WrongCoupon[]> {
  // Sessions where the trainer never set both coupon amounts → any coupon
  // issued for that session must be a legacy fallback row.
  const r: any = await sql`
    SELECT c.id  AS coupon_id,
           c.data->>'code'              AS code,
           c.data->>'session_id'        AS session_id,
           c.data->>'session_title'     AS session_title,
           lower(c.data->>'owner_email') AS owner_email,
           c.data->>'owner_name'        AS owner_name,
           COALESCE((c.data->>'discount_amount')::numeric, 0)        AS discount,
           COALESCE((c.data->>'commission_amount')::numeric, 0)      AS commission,
           COALESCE((c.data->>'current_uses')::int, 0)               AS current_uses
    FROM affiliate_coupons c
    JOIN training_calendar t
      ON t.id = c.data->>'session_id'
    WHERE COALESCE(NULLIF(t.data->>'couponDiscount','')::numeric, 0)   <= 0
       OR COALESCE(NULLIF(t.data->>'couponCommission','')::numeric, 0) <= 0
  `;
  const rows = Array.isArray(r) ? r : [];
  return rows.map((row: any) => ({
    couponId: row.coupon_id,
    code: row.code,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name,
    discount: Number(row.discount) || 0,
    commission: Number(row.commission) || 0,
    currentUses: Number(row.current_uses) || 0,
  }));
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({} as any));
    const dryRun = body?.dryRun !== false; // default true for safety

    const wrong = await findWrongCoupons();
    const deletable = wrong.filter(w => w.currentUses === 0);
    const protectedRows = wrong.filter(w => w.currentUses > 0);

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        candidates: deletable.length,
        protectedFromDelete: protectedRows.length,
        sample: deletable.slice(0, 25).map(w => ({
          code: w.code,
          ownerEmail: w.ownerEmail,
          ownerName: w.ownerName,
          sessionTitle: w.sessionTitle,
          discount: w.discount,
          commission: w.commission,
        })),
        protectedSample: protectedRows.slice(0, 10).map(w => ({
          code: w.code,
          ownerEmail: w.ownerEmail,
          sessionTitle: w.sessionTitle,
          currentUses: w.currentUses,
        })),
      });
    }

    // ── EXECUTE: delete the coupons + strip registration fields ────────────
    let deletedCoupons = 0;
    let cleanedRegs   = 0;
    const errors: { code: string; error: string }[] = [];

    // Group by sessionId for efficient registration patches.
    const bySession = new Map<string, WrongCoupon[]>();
    for (const w of deletable) {
      if (!bySession.has(w.sessionId)) bySession.set(w.sessionId, []);
      bySession.get(w.sessionId)!.push(w);
    }

    for (const [sessionId, list] of bySession.entries()) {
      const emails = list.map(w => w.ownerEmail).filter(Boolean);
      const codes  = list.map(w => w.code).filter(Boolean);

      // 1) Delete the coupon rows.
      try {
        const ids = list.map(w => w.couponId);
        const delRes: any = await sql`DELETE FROM affiliate_coupons WHERE id = ANY(${ids}::text[])`;
        // Neon HTTP returns rowCount on the result envelope; fall back to list size.
        deletedCoupons += Number(delRes?.rowCount ?? delRes?.count ?? list.length);
      } catch (err: any) {
        for (const w of list) errors.push({ code: w.code, error: String(err?.message || err) });
        continue;
      }

      // 2) Strip myCoupon* fields from any registration rows that reference
      //    these codes for this session (clears dead-code badges in the UI).
      if (emails.length > 0 || codes.length > 0) {
        try {
          const patch: any = await sql`
            UPDATE training_registrations
            SET data = (data
                         - 'myCouponCode'
                         - 'myCouponDiscount'
                         - 'myCouponCommission'
                         - 'myCouponActiveFrom'
                         - 'myCouponExpiresAt'
                         - 'myCouponIssuedAt'
                         - 'myCouponIssuedBy')
            WHERE session_id = ${sessionId}
              AND (
                lower(data->>'email')        = ANY(${emails}::text[])
                OR data->>'myCouponCode'     = ANY(${codes}::text[])
              )
          `;
          cleanedRegs += Number(patch?.rowCount ?? patch?.count ?? 0);
        } catch (err: any) {
          errors.push({ code: `session:${sessionId}`, error: `reg-patch: ${String(err?.message || err)}` });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun: false,
      deletedCoupons,
      cleanedRegistrations: cleanedRegs,
      protectedFromDelete: protectedRows.length,
      errors,
    });
  } catch (err: any) {
    console.error('purge-wrong-coupons error:', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
