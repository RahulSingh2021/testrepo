import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_enrolments (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

async function ensureAffiliateTables() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS affiliate_coupons (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS affiliate_transactions (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS affiliate_wallets (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS affiliate_settings (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS academy_courses (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  } catch {}
}

async function processAffiliateCreditByCode(couponCode: string, courseId: string, enrolleeName: string, enrolmentId: string, enrolleeUserId: string) {
  try {
    await ensureAffiliateTables();
    let couponResult;
    try {
      couponResult = await sql`SELECT id, data FROM affiliate_coupons WHERE data->>'code' = ${couponCode.toUpperCase()} AND data->>'active' = 'true' LIMIT 1`;
    } catch { couponResult = null; }
    const couponRows = Array.isArray(couponResult) ? couponResult : [];
    if (couponRows.length === 0) return;

    const coupon = couponRows[0].data;
    const couponId = couponRows[0].id;
    if (Number(coupon.current_uses) >= Number(coupon.max_uses)) return;

    const ownerId: string = coupon.owner_id;
    const ownerName: string = coupon.owner_name;

    if (ownerId === enrolleeUserId) {
      console.log('AffiliateCoupon: Self-referral blocked — owner and enrollee are the same user');
      return;
    }

    let existingTxResult;
    try {
      existingTxResult = await sql`SELECT id FROM affiliate_transactions WHERE data->>'owner_id' = ${ownerId} AND data->>'course_id' = ${courseId} AND data->>'enrollee_user_id' = ${enrolleeUserId} AND data->>'type' = 'commission' LIMIT 1`;
    } catch { existingTxResult = null; }
    const existingTxRows = Array.isArray(existingTxResult) ? existingTxResult : [];
    if (existingTxRows.length > 0) {
      console.log('AffiliateCoupon: Duplicate commission blocked — this user+course combination already credited');
      return;
    }

    let settingsResult;
    try {
      settingsResult = await sql`SELECT data FROM affiliate_settings WHERE id = 'global' LIMIT 1`;
    } catch { settingsResult = null; }
    const settingsRows = Array.isArray(settingsResult) ? settingsResult : [];
    const settings = settingsRows.length > 0 ? settingsRows[0].data : { commission_percent: 5 };
    const commissionPercent = Number(settings.commission_percent) || 5;

    let courseResult;
    try {
      courseResult = await sql`SELECT id, data FROM academy_courses WHERE id = ${courseId} LIMIT 1`;
    } catch { courseResult = null; }
    const courseRows = Array.isArray(courseResult) ? courseResult : [];
    if (courseRows.length === 0) return;
    const courseData = courseRows[0].data;
    const effectivePrice = Number(courseData.discountPrice) > 0 ? Number(courseData.discountPrice) : Number(courseData.price) || 0;
    if (effectivePrice <= 0) return;

    const commissionAmount = Math.round((effectivePrice * commissionPercent) / 100);

    const updatedCoupon = {
      ...coupon,
      current_uses: (Number(coupon.current_uses) || 0) + 1,
      total_commission_earned: (Number(coupon.total_commission_earned) || 0) + commissionAmount,
    };
    const couponJson = JSON.stringify(updatedCoupon);
    await sql`UPDATE affiliate_coupons SET data = ${couponJson}::jsonb, updated_at = NOW() WHERE id = ${couponId}`;

    const txId = `aftx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const txData = {
      owner_id: ownerId,
      owner_name: ownerName,
      coupon_id: couponId,
      coupon_code: coupon.code,
      course_id: courseId,
      course_name: courseData.title || '',
      commission_amount: commissionAmount,
      enrollee_name: enrolleeName,
      enrollee_user_id: enrolleeUserId,
      enrolment_id: enrolmentId,
      type: 'commission',
      created_at: new Date().toISOString(),
    };
    const txJson = JSON.stringify(txData);
    await sql`INSERT INTO affiliate_transactions (id, data, updated_at) VALUES (${txId}, ${txJson}::jsonb, NOW())`;

    let walletResult;
    try {
      walletResult = await sql`SELECT id, data FROM affiliate_wallets WHERE data->>'user_id' = ${ownerId} LIMIT 1`;
    } catch { walletResult = null; }
    const walletRows = Array.isArray(walletResult) ? walletResult : [];
    if (walletRows.length > 0) {
      const existing = walletRows[0].data;
      const updated = {
        ...existing,
        balance: (Number(existing.balance) || 0) + commissionAmount,
        total_earned: (Number(existing.total_earned) || 0) + commissionAmount,
        updated_at: new Date().toISOString(),
      };
      const walletJson = JSON.stringify(updated);
      await sql`UPDATE affiliate_wallets SET data = ${walletJson}::jsonb, updated_at = NOW() WHERE id = ${walletRows[0].id}`;
    } else {
      const walletId = `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const walletData = {
        user_id: ownerId,
        user_name: ownerName,
        balance: commissionAmount,
        total_earned: commissionAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const walletJson = JSON.stringify(walletData);
      await sql`INSERT INTO affiliate_wallets (id, data, updated_at) VALUES (${walletId}, ${walletJson}::jsonb, NOW())`;
    }
  } catch (err) {
    console.error('AcademyEnrolments: Affiliate credit failed (non-fatal):', err);
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const courseId = searchParams.get('course_id');

    let result;
    try {
      if (userId && courseId) {
        result = await sql`SELECT id, data FROM academy_enrolments WHERE data->>'user_id' = ${userId} AND data->>'course_id' = ${courseId} ORDER BY updated_at DESC`;
      } else if (userId) {
        result = await sql`SELECT id, data FROM academy_enrolments WHERE data->>'user_id' = ${userId} ORDER BY updated_at DESC`;
      } else if (courseId) {
        result = await sql`SELECT id, data FROM academy_enrolments WHERE data->>'course_id' = ${courseId} ORDER BY updated_at DESC`;
      } else {
        result = await sql`SELECT id, data FROM academy_enrolments ORDER BY updated_at DESC`;
      }
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('AcademyEnrolments: Failed to fetch:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });
    for (const item of items) {
      const { id, coupon_code, enrollee_name, ...data } = item;
      if (!data.enrolled_at) data.enrolled_at = new Date().toISOString();
      if (data.progress_percent === undefined) data.progress_percent = 0;

      let isNewInsert = false;
      try {
        const check = await sql`SELECT id FROM academy_enrolments WHERE id = ${String(id)} LIMIT 1`;
        isNewInsert = !Array.isArray(check) || check.length === 0;
      } catch { isNewInsert = true; }

      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO academy_enrolments (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;

      if (isNewInsert && coupon_code && data.course_id) {
        await processAffiliateCreditByCode(String(coupon_code), String(data.course_id), enrollee_name || '', String(id), String(data.user_id || ''));
      }
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('AcademyEnrolments: Failed to save:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM academy_enrolments WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM academy_enrolments WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademyEnrolments: Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
