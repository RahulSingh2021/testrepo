import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// One-shot bulk operation that wipes the `keyword` field on every row in
// the ingredients table. Stored as JSONB so we use `data - 'keyword'`
// (PostgreSQL's "remove key from JSONB") instead of trying to round-trip
// through the app. Touching `updated_at` so other clients pick up the
// change on their next refresh.
//
// Locked behind requireAdminSession because clearing thousands of rows
// can't be undone without a backup; the standard admin login flow is
// already established for super-admin actions.
export async function POST(request: NextRequest) {
  const adminAuthError = await requireAdminSession(request);
  if (adminAuthError) return adminAuthError;

  try {
    // `data ? 'keyword'` is the JSONB existence test; without it Postgres
    // would still rewrite every row even when no change is needed.
    const result = await sql`
      UPDATE ingredients
      SET data = data - 'keyword',
          updated_at = NOW()
      WHERE data ? 'keyword'
      RETURNING id
    `;
    const cleared = Array.isArray(result) ? result.length : 0;
    return NextResponse.json({ success: true, cleared });
  } catch (error) {
    console.error('Failed to clear ingredient keywords:', error);
    return NextResponse.json(
      { error: 'Failed to clear keywords' },
      { status: 500 }
    );
  }
}
