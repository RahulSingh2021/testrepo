import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import crypto from 'crypto';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const ensureTable = async () => {
  try {
    await sql`CREATE TABLE IF NOT EXISTS student_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )`;
    await sql`CREATE INDEX IF NOT EXISTS student_sessions_user_id_idx ON student_sessions(user_id)`;
  } catch {}
};

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { user_id, phone } = body;

    if (!user_id || !phone) {
      return NextResponse.json({ error: 'user_id and phone are required' }, { status: 400 });
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length < 6) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    let userResult;
    try {
      userResult = await sql`SELECT id, data FROM lms_users WHERE id = ${user_id} LIMIT 1`;
    } catch { userResult = null; }

    const userRows = Array.isArray(userResult) ? userResult : [];
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized: user not found' }, { status: 401 });
    }

    const userData = userRows[0].data || {};
    const storedPhone = String(userData.phone || userData.whatsapp || userData.mobile || '').replace(/\D/g, '');

    if (!storedPhone || !normalizedPhone.endsWith(storedPhone.slice(-8)) && !storedPhone.endsWith(normalizedPhone.slice(-8))) {
      return NextResponse.json({ error: 'Unauthorized: phone does not match records' }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await sql`INSERT INTO student_sessions (token, user_id, expires_at) VALUES (${token}, ${user_id}, ${expiresAt}::timestamptz)`;
    await sql`DELETE FROM student_sessions WHERE expires_at < NOW()`;

    return NextResponse.json({ token, expires_at: expiresAt });
  } catch (error) {
    console.error('StudentSession: Failed:', error);
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
  }
}
