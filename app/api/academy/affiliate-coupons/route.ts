import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import crypto from 'crypto';
import { requireAdminSession } from '@/lib/adminAuth';
import { requireStudentSession } from '@/lib/studentAuth';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS affiliate_coupons (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS affiliate_coupons_code_idx ON affiliate_coupons ((data->>'code'))`;
  } catch {}
};

function generateCouponCode(ownerName: string): string {
  const prefix = ownerName.replace(/\s+/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + suffix;
}

async function checkHasPaidEnrolment(ownerId: string): Promise<boolean> {
  try {
    const enrolResult = await sql`SELECT id, data FROM academy_enrolments WHERE data->>'user_id' = ${ownerId}`;
    const enrRows = Array.isArray(enrolResult) ? enrolResult : [];
    if (enrRows.length === 0) return false;
    const courseIds = enrRows.map((r: any) => r.data?.course_id).filter(Boolean);
    if (courseIds.length === 0) return false;
    for (const courseId of courseIds) {
      let courseResult;
      try {
        courseResult = await sql`SELECT id, data FROM academy_courses WHERE id = ${courseId} LIMIT 1`;
      } catch { courseResult = null; }
      const courseRows = Array.isArray(courseResult) ? courseResult : [];
      if (courseRows.length > 0) {
        const cd = courseRows[0].data;
        const effectivePrice = Number(cd.discountPrice) > 0 ? Number(cd.discountPrice) : Number(cd.price) || 0;
        if (effectivePrice > 0) return true;
      }
    }
    return false;
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      const authError = await requireAdminSession(request);
      if (authError) return authError;
      let result;
      try {
        result = await sql`SELECT id, data FROM affiliate_coupons ORDER BY updated_at DESC`;
      } catch { result = null; }
      const rows = Array.isArray(result) ? result : [];
      const items = rows.map((r: any) => {
        const { wallet_read_token: _t, ...safeData } = r.data;
        return { id: r.id, ...safeData };
      });
      return NextResponse.json({ items });
    }

    const sessionResult = await requireStudentSession(request, userId);
    if ('error' in sessionResult) return sessionResult.error;

    let result;
    try {
      result = await sql`SELECT id, data FROM affiliate_coupons WHERE data->>'owner_id' = ${userId} AND data->>'active' = 'true' ORDER BY updated_at DESC LIMIT 1`;
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => {
      const { wallet_read_token: _t, ...safeData } = r.data;
      return { id: r.id, ...safeData };
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('AffiliateCoupons: Failed to fetch:', error);
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { owner_id, owner_name, max_uses = 50 } = body;

    if (!owner_id || !owner_name) {
      return NextResponse.json({ error: 'owner_id and owner_name are required' }, { status: 400 });
    }

    const adminToken = request.headers.get('x-admin-token');
    if (adminToken) {
      const adminAuthError = await requireAdminSession(request);
      if (adminAuthError) return adminAuthError;
    } else {
      const sessionResult = await requireStudentSession(request, owner_id);
      if ('error' in sessionResult) return sessionResult.error;
    }

    const hasPaid = await checkHasPaidEnrolment(owner_id);
    if (!hasPaid) {
      return NextResponse.json({ error: 'Only students enrolled in paid courses can generate referral codes' }, { status: 403 });
    }

    let existingResult;
    try {
      existingResult = await sql`SELECT id, data FROM affiliate_coupons WHERE data->>'owner_id' = ${owner_id} AND data->>'active' = 'true' LIMIT 1`;
    } catch { existingResult = null; }

    if (Array.isArray(existingResult) && existingResult.length > 0) {
      const row = existingResult[0];
      return NextResponse.json({ coupon: { id: row.id, ...row.data } });
    }

    let code = generateCouponCode(owner_name);
    let attempts = 0;
    while (attempts < 10) {
      let check;
      try {
        check = await sql`SELECT id FROM affiliate_coupons WHERE data->>'code' = ${code} LIMIT 1`;
      } catch { check = null; }
      if (!Array.isArray(check) || check.length === 0) break;
      code = generateCouponCode(owner_name);
      attempts++;
    }

    const id = `afc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const data = {
      code,
      owner_id,
      owner_name,
      max_uses,
      current_uses: 0,
      total_commission_earned: 0,
      active: true,
      created_at: new Date().toISOString(),
    };
    const jsonData = JSON.stringify(data);
    await sql`INSERT INTO affiliate_coupons (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW())`;
    return NextResponse.json({ coupon: { id, ...data } });
  } catch (error) {
    console.error('AffiliateCoupons: Failed to create:', error);
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { coupon_id, owner_id } = body;
    if (!coupon_id || !owner_id) {
      return NextResponse.json({ error: 'coupon_id and owner_id are required' }, { status: 400 });
    }

    const sessionResult = await requireStudentSession(request, owner_id);
    if ('error' in sessionResult) return sessionResult.error;

    let existing;
    try {
      existing = await sql`SELECT id, data FROM affiliate_coupons WHERE id = ${coupon_id} AND data->>'owner_id' = ${owner_id} LIMIT 1`;
    } catch { existing = null; }
    const rows = Array.isArray(existing) ? existing : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Coupon not found or access denied' }, { status: 403 });
    }
    const updated = { ...rows[0].data, active: false, deactivated_at: new Date().toISOString() };
    const jsonData = JSON.stringify(updated);
    await sql`UPDATE affiliate_coupons SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${coupon_id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AffiliateCoupons: Failed to deactivate:', error);
    return NextResponse.json({ error: 'Failed to deactivate coupon' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureTable();
    const body = await request.json();
    const { id, increment_uses, increment_commission, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    let existing;
    try {
      existing = await sql`SELECT id, data FROM affiliate_coupons WHERE id = ${id} LIMIT 1`;
    } catch { existing = null; }

    const rows = Array.isArray(existing) ? existing : [];
    if (rows.length === 0) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });

    const current = { ...rows[0].data, ...updates };

    if (increment_uses !== undefined) {
      current.current_uses = (Number(current.current_uses) || 0) + Number(increment_uses);
    }
    if (increment_commission !== undefined) {
      current.total_commission_earned = (Number(current.total_commission_earned) || 0) + Number(increment_commission);
    }

    const jsonData = JSON.stringify(current);
    await sql`UPDATE affiliate_coupons SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${id}`;
    const { wallet_read_token: _t, ...safeData } = current;
    return NextResponse.json({ success: true, coupon: { id, ...safeData } });
  } catch (error) {
    console.error('AffiliateCoupons: Failed to update:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
