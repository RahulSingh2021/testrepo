import crypto from 'crypto';
import sql from '@/lib/db';

// ── Marketing-list unsubscribe helpers ──────────────────────────────────────
// Bulk emails carry a tokenised unsubscribe link of the form
//   /api/marketing-unsubscribe?t=<base64url(email:hmac)>
// The token is HMAC-signed so a recipient can't trivially unsubscribe an
// arbitrary address by guessing the URL. The `marketing_unsubscribes`
// table is the source of truth — both the campaign sender and the
// participants merge step skip any address listed here.

// HMAC secret for unsubscribe tokens. We deliberately do NOT bake in a
// hardcoded fallback — a known constant would let anyone forge unsubscribe
// links and silently opt arbitrary addresses out. We accept either an
// explicit UNSUBSCRIBE_SECRET, or fall back to SMTP_PASS (already required
// for the bulk-mail SMTP transport, so it must be present in any env where
// marketing email could actually be sent). If neither exists, every
// token-related call throws so the failure is loud and fixable.
function getSecret(): string {
  const s = (process.env.UNSUBSCRIBE_SECRET || process.env.SMTP_PASS || '').toString();
  if (!s) {
    throw new Error('Marketing unsubscribe secret is not configured. Set UNSUBSCRIBE_SECRET (or ensure SMTP_PASS is set).');
  }
  return s;
}

const lc = (s: unknown): string => String(s ?? '').trim().toLowerCase();

let schemaReady: Promise<void> | null = null;
export function ensureUnsubscribeSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS marketing_unsubscribes (
        email TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
    })().catch(err => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

function sign(email: string): string {
  return crypto.createHmac('sha256', getSecret()).update(lc(email)).digest('hex').slice(0, 16);
}

export function makeUnsubscribeToken(email: string): string {
  const e = lc(email);
  if (!e) return '';
  const sig = sign(e);
  return Buffer.from(`${e}:${sig}`).toString('base64url');
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const idx = decoded.lastIndexOf(':');
    if (idx < 0) return null;
    const email = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    if (!email || !sig) return null;
    const expected = sign(email);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return lc(email);
  } catch {
    return null;
  }
}

interface ExistsRow { exists?: unknown }
interface EmailRow { email: string }

export async function isUnsubscribed(email: string): Promise<boolean> {
  const e = lc(email);
  if (!e) return false;
  try {
    await ensureUnsubscribeSchema();
    const rows = (await sql`SELECT 1 AS exists FROM marketing_unsubscribes WHERE email = ${e} LIMIT 1`) as unknown as ExistsRow[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function getUnsubscribedSet(): Promise<Set<string>> {
  try {
    await ensureUnsubscribeSchema();
    const rows = (await sql`SELECT email FROM marketing_unsubscribes`) as unknown as EmailRow[];
    return new Set((rows || []).map(r => lc(r.email)));
  } catch {
    return new Set();
  }
}

// Persists the opt-out. We deliberately throw on failure so the calling
// HTTP handler can surface an error to the recipient instead of silently
// falsely confirming an unsubscribe that never reached the database.
export async function recordUnsubscribe(email: string, meta?: Record<string, unknown>): Promise<void> {
  const e = lc(email);
  if (!e) throw new Error('recordUnsubscribe: empty email');
  await ensureUnsubscribeSchema();
  const data = JSON.stringify({ unsubscribedAt: new Date().toISOString(), ...(meta || {}) });
  await sql`INSERT INTO marketing_unsubscribes (email, data) VALUES (${e}, ${data}::jsonb)
            ON CONFLICT (email) DO UPDATE SET data = EXCLUDED.data`;
}
