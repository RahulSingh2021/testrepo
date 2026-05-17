import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, course_price } = body;

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Coupon code is required' }, { status: 400 });
    }

    let result;
    try {
      result = await sql`SELECT id, data FROM affiliate_coupons WHERE data->>'code' = ${code.toUpperCase()} LIMIT 1`;
    } catch { result = null; }

    const rows = Array.isArray(result) ? result : [];
    if (rows.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invalid coupon code' });
    }

    const coupon = { id: rows[0].id, ...rows[0].data };

    if (!coupon.active) {
      return NextResponse.json({ valid: false, error: 'This coupon has been disabled' });
    }

    if (coupon.active_from) {
      const today = new Date().toISOString().slice(0, 10);
      if (today < coupon.active_from) {
        const activeDateLabel = new Date(coupon.active_from + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        return NextResponse.json({ valid: false, error: `This coupon becomes active on ${activeDateLabel}` });
      }
    }

    if (coupon.expires_at) {
      const today = new Date().toISOString().slice(0, 10);
      if (today > coupon.expires_at) {
        return NextResponse.json({ valid: false, error: 'This coupon has expired' });
      }
    }

    if (Number(coupon.current_uses) >= Number(coupon.max_uses)) {
      return NextResponse.json({ valid: false, error: 'This coupon has reached its usage limit (5 uses)' });
    }

    const price = Number(course_price) || 0;
    const discountAmount = Number(coupon.discount_amount) || 0;
    const commissionAmount = Number(coupon.commission_amount) || 0;
    const finalPrice = Math.max(0, price - discountAmount);

    return NextResponse.json({
      valid: true,
      coupon_id: coupon.id,
      code: coupon.code,
      owner_id: coupon.owner_id,
      owner_name: coupon.owner_name,
      discount_amount: discountAmount,
      commission_amount: commissionAmount,
      final_price: finalPrice,
      uses_remaining: Number(coupon.max_uses) - Number(coupon.current_uses),
    });
  } catch (error) {
    console.error('AffiliateCoupons validate: Failed:', error);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
