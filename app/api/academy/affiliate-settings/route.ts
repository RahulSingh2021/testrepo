import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS affiliate_settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const DEFAULT_SETTINGS = {
  discount_percent: 10,
  commission_percent: 5,
  default_max_uses: 50,
};

export async function GET() {
  try {
    await ensureTable();
    let result;
    try {
      result = await sql`SELECT id, data FROM affiliate_settings WHERE id = 'global' LIMIT 1`;
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const settings = rows.length > 0 ? { id: rows[0].id, ...rows[0].data } : { id: 'global', ...DEFAULT_SETTINGS };
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('AffiliateSettings: Failed to fetch:', error);
    return NextResponse.json({ settings: { id: 'global', ...DEFAULT_SETTINGS } });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureTable();
    const body = await request.json();
    const { id: _id, ...data } = body;
    const jsonData = JSON.stringify(data);
    await sql`INSERT INTO affiliate_settings (id, data, updated_at) VALUES ('global', ${jsonData}::jsonb, NOW())
              ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AffiliateSettings: Failed to save:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
