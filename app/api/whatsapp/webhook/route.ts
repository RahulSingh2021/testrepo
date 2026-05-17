import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import sql from '@/lib/db';

// Verifies Meta's webhook signature header (X-Hub-Signature-256). Meta
// signs every POST body with HMAC-SHA256 using your App Secret. Without
// this check, anyone who learns the webhook URL can forge inbound
// messages and status receipts.
//
// We make the check OPT-IN: if WHATSAPP_APP_SECRET is unset we skip
// verification (so existing test setups keep working) and log a warning
// once. Set the secret to enforce.
let warnedNoSecret = false;
function verifySignature(rawBody: string, header: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    if (!warnedNoSecret) {
      console.warn('[whatsapp/webhook] WHATSAPP_APP_SECRET not set — accepting unsigned payloads. Set this secret to require Meta-signed requests.');
      warnedNoSecret = true;
    }
    return true;
  }
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

// Meta WhatsApp Cloud API webhook.
//
// One endpoint, two purposes:
//
//   GET  /api/whatsapp/webhook
//     Verification handshake. Meta calls this once when you register the
//     webhook URL in the Meta App dashboard. We must echo `hub.challenge`
//     back as plain text iff `hub.verify_token` matches the secret you
//     configured in Meta. The secret lives in env var
//     WHATSAPP_WEBHOOK_VERIFY_TOKEN — pick any string; whatever you set
//     here you also paste into the Meta dashboard.
//
//   POST /api/whatsapp/webhook
//     Live event delivery. Meta posts JSON for two kinds of events:
//       - `messages` array  → an inbound message from a customer
//       - `statuses` array  → a delivery/read/failed receipt for a message
//                             we sent earlier (matched by `wamid`)
//
// We persist both into `whatsapp_messages` so the in-app Inbox can show a
// live two-way conversation. Inbound messages start as `read_by_admin =
// false` so the inbox can render an unread badge.
//
// IMPORTANT: Meta retries failed deliveries aggressively. We always
// return HTTP 200 (even on parse errors) so Meta doesn't enter a retry
// storm — anything malformed gets logged and dropped silently.

async function ensureTable() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id BIGSERIAL PRIMARY KEY,
      wamid TEXT UNIQUE,
      direction TEXT NOT NULL,
      phone TEXT NOT NULL,
      contact_name TEXT,
      message_type TEXT,
      body TEXT,
      template_name TEXT,
      status TEXT,
      error TEXT,
      raw JSONB,
      read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_created_idx ON whatsapp_messages(phone, created_at DESC)`;
  } catch {}
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge') || '';
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expected) {
    return new NextResponse('verify token not configured', { status: 500 });
  }
  if (mode === 'subscribe' && token === expected) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new NextResponse('forbidden', { status: 403 });
}

// Distill the body string out of any of the message shapes Meta sends. We
// keep the full payload in `raw` so the UI can pull richer detail later
// (e.g. media URLs, location coords) without us having to round-trip the
// schema for every new message type.
function summarizeMessage(msg: any): { type: string; body: string } {
  const t = String(msg?.type || 'unknown');
  if (t === 'text') return { type: 'text', body: String(msg.text?.body || '') };
  if (t === 'button') return { type: 'button', body: String(msg.button?.text || msg.button?.payload || '') };
  if (t === 'interactive') {
    const i = msg.interactive || {};
    if (i.button_reply) return { type: 'interactive', body: String(i.button_reply.title || i.button_reply.id || '') };
    if (i.list_reply) return { type: 'interactive', body: String(i.list_reply.title || i.list_reply.id || '') };
    return { type: 'interactive', body: '' };
  }
  if (t === 'image') return { type: 'image', body: String(msg.image?.caption || '[image]') };
  // Use the same `[<type>]` shape as the other media placeholders so the
  // inbox UI's caption-suppression check (which compares against
  // `[audio]`) doesn't mistake the placeholder for a real caption.
  if (t === 'audio') return { type: 'audio', body: '[audio]' };
  if (t === 'video') return { type: 'video', body: String(msg.video?.caption || '[video]') };
  if (t === 'document') return { type: 'document', body: String(msg.document?.filename || msg.document?.caption || '[document]') };
  if (t === 'sticker') return { type: 'sticker', body: '[sticker]' };
  if (t === 'location') return { type: 'location', body: '[location]' };
  if (t === 'reaction') return { type: 'reaction', body: String(msg.reaction?.emoji || '[reaction]') };
  if (t === 'contacts') return { type: 'contacts', body: '[contact card]' };
  // `unsupported` is what Meta sends when the customer sent a message
  // type the Cloud API can't decode for us (newer sticker formats,
  // certain interactive replies, etc). The full payload is preserved
  // in `raw`; the inbox UI only needs a clean human label here so we
  // don't spill JSON into the conversation thread.
  if (t === 'unsupported') return { type: 'unsupported', body: '[unsupported message]' };
  return { type: t, body: `[${t}]` };
}

export async function POST(request: NextRequest) {
  // Read raw text first so we can verify the HMAC signature on the exact
  // bytes Meta signed — re-serializing parsed JSON would change spacing
  // and break the comparison.
  let raw = '';
  try { raw = await request.text(); } catch {}
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'))) {
    console.warn('[whatsapp/webhook] rejected unsigned/invalid-signature POST');
    // Still 200 so Meta doesn't retry, but we don't process anything.
    return NextResponse.json({ ok: true });
  }
  let payload: any = null;
  try { payload = JSON.parse(raw); } catch {}
  if (!payload) return NextResponse.json({ ok: true });

  await ensureTable();

  try {
    const entries: any[] = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        // Map a phone wa_id → display name from the contacts array (Meta
        // sends contacts and messages as parallel arrays in the same value).
        const contactsByWaId: Record<string, string> = {};
        for (const c of (Array.isArray(value.contacts) ? value.contacts : [])) {
          if (c?.wa_id) contactsByWaId[String(c.wa_id)] = String(c?.profile?.name || '');
        }

        // ── Inbound messages ────────────────────────────────────────────
        for (const msg of (Array.isArray(value.messages) ? value.messages : [])) {
          const wamid = String(msg.id || '');
          const from = String(msg.from || '');
          if (!from) continue;
          const { type, body } = summarizeMessage(msg);
          const name = contactsByWaId[from] || null;
          try {
            await sql`INSERT INTO whatsapp_messages
                        (wamid, direction, phone, contact_name, message_type, body, status, raw, read_by_admin)
                      VALUES
                        (${wamid || null}, 'in', ${from}, ${name}, ${type}, ${body}, 'received', ${JSON.stringify(msg)}::jsonb, FALSE)
                      ON CONFLICT (wamid) DO NOTHING`;
          } catch (err) {
            console.error('[whatsapp/webhook] insert inbound failed', err);
          }
        }

        // ── Status receipts (matches a wamid we sent earlier) ───────────
        //
        // Race: a delivery/read receipt can arrive before our outbound
        // INSERT lands (or for messages sent outside this app entirely).
        // To avoid silently dropping the receipt, we INSERT a placeholder
        // row keyed by wamid; if the outbound row already exists, the
        // ON CONFLICT branch UPDATEs status/error in place.
        for (const stat of (Array.isArray(value.statuses) ? value.statuses : [])) {
          const wamid = String(stat.id || '');
          const status = String(stat.status || '');
          const errMsg = stat?.errors?.[0]?.title || stat?.errors?.[0]?.message || null;
          const recipient = String(stat.recipient_id || '');
          if (!wamid || !status) continue;
          try {
            await sql`INSERT INTO whatsapp_messages
                        (wamid, direction, phone, message_type, body, status, error, raw, read_by_admin)
                      VALUES
                        (${wamid}, 'out', ${recipient}, 'unknown', NULL,
                         ${status}, ${errMsg}, ${JSON.stringify(stat)}::jsonb, TRUE)
                      ON CONFLICT (wamid) DO UPDATE
                        SET status = EXCLUDED.status,
                            error  = COALESCE(EXCLUDED.error, whatsapp_messages.error)`;
          } catch (err) {
            console.error('[whatsapp/webhook] upsert status failed', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp/webhook] payload processing failed', err);
  }

  // ALWAYS 200 — see comment at top of file.
  return NextResponse.json({ ok: true });
}
