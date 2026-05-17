import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// Keys that mutate global, security-sensitive matcher behavior. Writes
// to these keys must be authenticated as a super-admin; reads stay
// public so the matcher can hydrate at page load without leaking
// auth tokens through every component. Other keys (popup feature flag,
// WA country codes, etc.) keep the legacy unauthenticated POST so we
// don't silently break older callers.
const ADMIN_WRITE_KEYS = new Set<string>(['food_synonyms_overrides']);

// Validate the JSON shape we accept for `food_synonyms_overrides` so a
// malformed POST can't crash every client at load time. Stored value
// is the JSON-stringified object {canonical: string[]}.
function validateSynonymOverridesPayload(value: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value || '{}');
  } catch (err) {
    return `value is not valid JSON: ${(err as Error).message}`;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'value must be a JSON object {canonical: string[]}';
  }
  for (const k of Object.keys(parsed as Record<string, unknown>)) {
    const arr = (parsed as Record<string, unknown>)[k];
    if (!Array.isArray(arr)) return `entry "${k}" must be an array of strings`;
    for (const s of arr) {
      if (typeof s !== 'string') return `entry "${k}" contains a non-string synonym`;
    }
  }
  return null;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

// @neondatabase/serverless v1.0.2 has a bug where `SELECT col, col FROM tbl`
// on an empty result set throws "Cannot read properties of null (reading
// 'map')" inside the library. Treat that as an empty result so callers
// don't 500 when the table is simply empty.
function isEmptyResultBug(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    /Cannot read properties of null \(reading 'map'\)/.test(err.message)
  );
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const key = request.nextUrl.searchParams.get('key') || '';
    if (key) {
      let rows: Array<{ value: string }> = [];
      try {
        rows = (await sql`SELECT value FROM app_settings WHERE key = ${key}`) as Array<{
          value: string;
        }>;
      } catch (err) {
        if (!isEmptyResultBug(err)) throw err;
      }
      return NextResponse.json({ key, value: rows?.[0]?.value ?? null });
    }
    let rows: Array<{ key: string; value: string }> = [];
    try {
      rows = (await sql`SELECT key, value FROM app_settings`) as Array<{
        key: string;
        value: string;
      }>;
    } catch (err) {
      if (!isEmptyResultBug(err)) throw err;
    }
    const result: Record<string, string> = {};
    for (const r of (rows || [])) result[r.key] = r.value;
    return NextResponse.json(result);
  } catch (err) {
    console.error('[app-settings GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { key, value } = body as { key: string; value: string };
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    // Sensitive global-config keys require an admin session; payload is
    // also schema-validated so a malformed JSON blob can't crash every
    // client that loads it at startup.
    if (ADMIN_WRITE_KEYS.has(key)) {
      const authErr = await requireAdminSession(request);
      if (authErr) return authErr;
      if (key === 'food_synonyms_overrides') {
        const validationErr = validateSynonymOverridesPayload(value ?? '');
        if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });
      }
    }
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${key}, ${value ?? ''}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[app-settings POST]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
