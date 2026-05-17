import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

async function ensureSessionTable() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )`;
  } catch {}
}

export async function requireAdminSession(request: NextRequest): Promise<NextResponse | null> {
  const token = request.headers.get('x-admin-token');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: no session token' }, { status: 401 });
  }
  try {
    await ensureSessionTable();
    let result;
    try {
      result = await sql`SELECT email FROM admin_sessions WHERE token = ${token} AND expires_at > NOW() LIMIT 1`;
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized: invalid or expired session' }, { status: 401 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: 'Unauthorized: session check failed' }, { status: 401 });
  }
}
