import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const couponCode = searchParams.get('coupon_code');

    if (couponCode) {
      const txResult = await sql`SELECT id, data, created_at FROM affiliate_transactions WHERE data->>'coupon_code' = ${couponCode.toUpperCase()} ORDER BY created_at DESC`;
      const txRows = Array.isArray(txResult) ? txResult : [];

      const usages: any[] = [];
      for (const tx of txRows) {
        const d = tx.data || {};
        let regData: any = null;
        if (d.registration_id) {
          try {
            const regResult = await sql`SELECT id, data FROM training_registrations WHERE id = ${d.registration_id} LIMIT 1`;
            const regRows = Array.isArray(regResult) ? regResult : [];
            if (regRows.length > 0) regData = regRows[0].data;
          } catch {}
        }

        let sessionData: any = null;
        if (d.session_id) {
          try {
            const sessResult = await sql`SELECT id, data FROM training_calendar WHERE id = ${d.session_id} LIMIT 1`;
            const sessRows = Array.isArray(sessResult) ? sessResult : [];
            if (sessRows.length > 0) sessionData = sessRows[0].data;
          } catch {}
        }

        usages.push({
          transactionId: tx.id,
          enrolleeName: d.enrollee_name || '—',
          enrolleeEmail: d.enrollee_email || '—',
          commissionEarned: Number(d.commission_amount) || 0,
          registrationDate: regData?.createdAt || d.created_at || null,
          trainingDate: sessionData?.date || null,
          trainingName: d.course_name || sessionData?.topic || '—',
          sessionId: d.session_id || null,
          courseFee: Number(sessionData?.courseFee) || 0,
          discount: Number(regData?.couponDiscount) || Number(sessionData?.discount) || 0,
          paidAmount: Number(regData?.paidAmount) || 0,
          couponDiscount: Number(regData?.couponDiscount) || 0,
        });
      }

      return NextResponse.json({ usages });
    }

    if (!email) {
      return NextResponse.json({ error: 'email or coupon_code required' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const couponResult = await sql`SELECT id, data, created_at FROM affiliate_coupons WHERE LOWER(data->>'owner_email') = ${emailLower} ORDER BY created_at DESC`;
    const couponRows = Array.isArray(couponResult) ? couponResult : [];

    const coupons = couponRows.map((row: any) => {
      const d = row.data || {};
      return {
        id: row.id,
        code: d.code,
        sessionId: d.session_id,
        sessionTitle: d.session_title || '—',
        discountAmount: Number(d.discount_amount) || 0,
        commissionAmount: Number(d.commission_amount) || 0,
        maxUses: Number(d.max_uses) || 5,
        currentUses: Number(d.current_uses) || 0,
        totalCommissionEarned: Number(d.total_commission_earned) || 0,
        activeFrom: d.active_from || null,
        expiresAt: d.expires_at || null,
        active: d.active !== false,
        createdAt: d.created_at || row.created_at,
      };
    });

    return NextResponse.json({ coupons });
  } catch (err) {
    console.error('affiliate-coupons/track GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch coupon data' }, { status: 500 });
  }
}
