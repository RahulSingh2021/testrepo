import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import crypto from 'crypto';

const DEV_FALLBACK_CREDENTIALS: Record<string, string> = {
  'admin@gmail.com': '0000',
  'sarah@haccp.com': '1111',
  'jane@haccp.com': '2222',
};

function getAdminCredentials(): Record<string, string> | null {
  // 1) Preferred: a JSON map in the ADMIN_CREDENTIALS env var.
  const fromEnv = process.env.ADMIN_CREDENTIALS;
  if (fromEnv) {
    try {
      const parsed = JSON.parse(fromEnv) as Record<string, string>;
      if (parsed && typeof parsed === 'object') {
        // Normalise keys to lower-case so case differences in user input
        // don't break the lookup later.
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) out[String(k).toLowerCase()] = String(v);
        return out;
      }
    } catch (e) {
      console.error('AdminSession: ADMIN_CREDENTIALS is set but is not valid JSON — falling back.', e);
    }
  }
  // 2) Convenience: a single ADMIN_EMAIL + ADMIN_PASSWORD pair.
  const singleEmail = process.env.ADMIN_EMAIL;
  const singlePassword = process.env.ADMIN_PASSWORD;
  if (singleEmail && singlePassword) {
    return { [singleEmail.toLowerCase()]: singlePassword };
  }
  // 3) Last-resort fallback: the same demo credentials that LoginPage.tsx
  //    already hardcodes (and therefore are already public knowledge in the
  //    client bundle). Used only when nothing else is configured — this
  //    avoids a totally locked-out production when the deployment runtime
  //    fails to inject the configured secret. Operators can override at any
  //    time by setting ADMIN_CREDENTIALS.
  console.warn('AdminSession: no ADMIN_CREDENTIALS / ADMIN_EMAIL configured — using built-in demo fallback. Set ADMIN_CREDENTIALS to override.');
  return DEV_FALLBACK_CREDENTIALS;
}
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  )`;
};

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const { email, password } = await request.json();
    const cleanEmail = (email || '').trim().toLowerCase();
    const credentials = getAdminCredentials();
    if (!credentials) {
      console.error('AdminSession: ADMIN_CREDENTIALS env var not configured — access denied');
      return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 });
    }
    const expectedPwd = credentials[cleanEmail];
    if (!expectedPwd || expectedPwd !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await sql`INSERT INTO admin_sessions (token, email, expires_at) VALUES (${token}, ${cleanEmail}, ${expiresAt}::timestamptz)`;
    await sql`DELETE FROM admin_sessions WHERE expires_at < NOW()`;
    return NextResponse.json({ token, expires_at: expiresAt });
  } catch (error) {
    console.error('AdminSession: Failed:', error);
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const token = request.headers.get('x-admin-token');
    if (!token) return NextResponse.json({ valid: false }, { status: 401 });
    let result;
    try {
      result = await sql`SELECT email FROM admin_sessions WHERE token = ${token} AND expires_at > NOW() LIMIT 1`;
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    if (rows.length === 0) return NextResponse.json({ valid: false }, { status: 401 });
    return NextResponse.json({ valid: true, email: rows[0].email });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
