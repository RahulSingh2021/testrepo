import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { requireStudentSession } from '@/lib/studentAuth';

const ensureTables = async () => {
  await sql`CREATE TABLE IF NOT EXISTS affiliate_wallets (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_transactions (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const allWallets = searchParams.get('all') === 'true';

    if (allWallets) {
      const authError = await requireAdminSession(request);
      if (authError) return authError;
      let walletResult, txResult;
      try {
        walletResult = await sql`SELECT id, data FROM affiliate_wallets ORDER BY updated_at DESC`;
        txResult = await sql`SELECT id, data FROM affiliate_transactions ORDER BY updated_at DESC`;
      } catch { walletResult = null; txResult = null; }
      const wallets = (Array.isArray(walletResult) ? walletResult : []).map((r: any) => ({ id: r.id, ...r.data }));
      const transactions = (Array.isArray(txResult) ? txResult : []).map((r: any) => ({ id: r.id, ...r.data }));
      return NextResponse.json({ wallets, transactions });
    }

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const studentToken = request.headers.get('x-student-token');
    if (studentToken) {
      const sessionResult = await requireStudentSession(request, userId);
      if ('error' in sessionResult) return sessionResult.error;
    } else {
      const adminAuthError = await requireAdminSession(request);
      if (adminAuthError) return adminAuthError;
    }

    let walletResult, txResult;
    try {
      walletResult = await sql`SELECT id, data FROM affiliate_wallets WHERE data->>'user_id' = ${userId} LIMIT 1`;
      txResult = await sql`SELECT id, data FROM affiliate_transactions WHERE data->>'owner_id' = ${userId} ORDER BY updated_at DESC`;
    } catch { walletResult = null; txResult = null; }

    const walletRows = Array.isArray(walletResult) ? walletResult : [];
    const wallet = walletRows.length > 0 ? { id: walletRows[0].id, ...walletRows[0].data } : {
      id: `wall-${userId}`,
      user_id: userId,
      balance: 0,
      total_earned: 0,
    };
    const transactions = (Array.isArray(txResult) ? txResult : []).map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ wallet, transactions });
  } catch (error) {
    console.error('AffiliateWallet: Failed to fetch:', error);
    return NextResponse.json({ wallet: null, transactions: [] });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureTables();
    const body = await request.json();
    const { owner_id, owner_name, coupon_id, coupon_code, course_id, course_name, commission_amount, enrollee_name } = body;

    if (!owner_id || !commission_amount) {
      return NextResponse.json({ error: 'owner_id and commission_amount are required' }, { status: 400 });
    }

    const txId = `aftx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const txData = {
      owner_id,
      owner_name,
      coupon_id,
      coupon_code,
      course_id,
      course_name,
      commission_amount: Number(commission_amount),
      enrollee_name,
      created_at: new Date().toISOString(),
    };
    const txJson = JSON.stringify(txData);
    await sql`INSERT INTO affiliate_transactions (id, data, updated_at) VALUES (${txId}, ${txJson}::jsonb, NOW())`;

    let walletResult;
    try {
      walletResult = await sql`SELECT id, data FROM affiliate_wallets WHERE data->>'user_id' = ${owner_id} LIMIT 1`;
    } catch { walletResult = null; }

    const walletRows = Array.isArray(walletResult) ? walletResult : [];
    if (walletRows.length > 0) {
      const existing = walletRows[0].data;
      const updated = {
        ...existing,
        balance: (Number(existing.balance) || 0) + Number(commission_amount),
        total_earned: (Number(existing.total_earned) || 0) + Number(commission_amount),
        updated_at: new Date().toISOString(),
      };
      const walletJson = JSON.stringify(updated);
      await sql`UPDATE affiliate_wallets SET data = ${walletJson}::jsonb, updated_at = NOW() WHERE id = ${walletRows[0].id}`;
      return NextResponse.json({ success: true, wallet: { id: walletRows[0].id, ...updated }, transaction_id: txId });
    } else {
      const walletId = `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const walletData = {
        user_id: owner_id,
        user_name: owner_name,
        balance: Number(commission_amount),
        total_earned: Number(commission_amount),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const walletJson = JSON.stringify(walletData);
      await sql`INSERT INTO affiliate_wallets (id, data, updated_at) VALUES (${walletId}, ${walletJson}::jsonb, NOW())`;
      return NextResponse.json({ success: true, wallet: { id: walletId, ...walletData }, transaction_id: txId });
    }
  } catch (error) {
    console.error('AffiliateWallet: Failed to record transaction:', error);
    return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureTables();
    const body = await request.json();
    const { user_id, action } = body;

    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

    let walletResult;
    try {
      walletResult = await sql`SELECT id, data FROM affiliate_wallets WHERE data->>'user_id' = ${user_id} LIMIT 1`;
    } catch { walletResult = null; }

    const walletRows = Array.isArray(walletResult) ? walletResult : [];
    if (walletRows.length === 0) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    const existing = walletRows[0].data;

    if (action === 'mark_paid') {
      const payoutAmount = Number(existing.balance) || 0;
      const updated = {
        ...existing,
        balance: 0,
        last_payout: payoutAmount,
        last_payout_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const walletJson = JSON.stringify(updated);
      await sql`UPDATE affiliate_wallets SET data = ${walletJson}::jsonb, updated_at = NOW() WHERE id = ${walletRows[0].id}`;

      const payoutTxId = `afpo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const payoutTxData = {
        owner_id: user_id,
        owner_name: existing.user_name || user_id,
        type: 'payout',
        commission_amount: -payoutAmount,
        payout_amount: payoutAmount,
        created_at: new Date().toISOString(),
      };
      const payoutTxJson = JSON.stringify(payoutTxData);
      try {
        await sql`INSERT INTO affiliate_transactions (id, data, updated_at) VALUES (${payoutTxId}, ${payoutTxJson}::jsonb, NOW())`;
      } catch {}

      return NextResponse.json({ success: true, wallet: { id: walletRows[0].id, ...updated }, payout_logged: true, payout_amount: payoutAmount });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('AffiliateWallet: Failed to update:', error);
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 });
  }
}
