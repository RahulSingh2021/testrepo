import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

async function ensureSessionTable() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS student_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )`;
  } catch {}
}

const DEV_BYPASS_TOKEN = 'dummy-student-token';
const DEV_BYPASS_USER_ID = 'student-demo-001';

export async function requireStudentSession(
  request: NextRequest,
  expectedUserId?: string,
): Promise<{ error: NextResponse } | { userId: string }> {
  const token = request.headers.get('x-student-token');
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized: student session token required' }, { status: 401 }) };
  }

  if (process.env.NODE_ENV !== 'production' && token === DEV_BYPASS_TOKEN) {
    const resolvedId = expectedUserId || DEV_BYPASS_USER_ID;
    return { userId: resolvedId };
  }

  try {
    await ensureSessionTable();
    let result;
    try {
      result = await sql`SELECT user_id FROM student_sessions WHERE token = ${token} AND expires_at > NOW() LIMIT 1`;
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    if (rows.length === 0) {
      return { error: NextResponse.json({ error: 'Unauthorized: invalid or expired student session' }, { status: 401 }) };
    }
    const sessionUserId: string = rows[0].user_id;
    if (expectedUserId && sessionUserId !== expectedUserId) {
      return { error: NextResponse.json({ error: 'Unauthorized: session user mismatch' }, { status: 403 }) };
    }
    return { userId: sessionUserId };
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized: session check failed' }, { status: 401 }) };
  }
}
