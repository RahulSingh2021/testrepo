import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { sendWhatsAppText, normalizePhone, logOutboundMessage } from '@/lib/whatsappSendCore';

// Admin-only inbox API for the WhatsApp two-way chat.
//
//   GET  /api/whatsapp/inbox?action=conversations
//     → list of distinct phones with the most recent message + unread count.
//
//   GET  /api/whatsapp/inbox?phone=918XXXXXXXXX&limit=200
//     → ordered messages for a single conversation.
//     Side effect: marks all inbound messages on that phone as read.
//
//   POST /api/whatsapp/inbox  { phone, text }
//     → sends a free-form text reply via Meta Cloud API.
//     Note: Meta only allows free-form text within a 24-hour customer
//     service window after the customer's last inbound message. Outside
//     that window the API returns an error and we surface it verbatim.
//
//   POST /api/whatsapp/inbox?action=mark-read  { phone }
//     → mark all inbound messages from `phone` as read (clears the badge).

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
  const adminError = await requireAdminSession(request);
  if (adminError) return adminError;
  await ensureTable();

  const params = request.nextUrl.searchParams;
  const action = params.get('action');
  const phone = params.get('phone');

  if (action === 'unread-count') {
    // Lightweight poll endpoint for the floating WhatsApp icon badge.
    // Returns total unread inbound count + last inbound timestamp so the
    // client can decide whether to play a notification tone.
    let unread = 0;
    let lastIn: string | null = null;
    try {
      const r: any = await sql`
        SELECT
          SUM(CASE WHEN direction='in' AND read_by_admin=FALSE THEN 1 ELSE 0 END)::int AS unread,
          MAX(CASE WHEN direction='in' THEN created_at END) AS last_in
        FROM whatsapp_messages
      `;
      const row = Array.isArray(r) && r.length > 0 ? r[0] : null;
      if (row) {
        unread = Number(row.unread || 0);
        lastIn = row.last_in ? new Date(row.last_in).toISOString() : null;
      }
    } catch {}
    return NextResponse.json({ unread, lastInbound: lastIn });
  }

  if (action === 'health') {
    // Diagnostic snapshot for the inbox header banner. Tells the admin at
    // a glance whether the webhook is wired correctly and whether any
    // inbound traffic has actually been received.
    const cfgPhone   = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
    const cfgToken   = !!process.env.WHATSAPP_ACCESS_TOKEN;
    const cfgVerify  = !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const cfgSecret  = !!process.env.WHATSAPP_APP_SECRET;
    let inCount = 0, outCount = 0, lastIn: string | null = null, lastOut: string | null = null;
    try {
      const stats: any = await sql`
        SELECT
          SUM(CASE WHEN direction = 'in' THEN 1 ELSE 0 END)::int                     AS in_count,
          SUM(CASE WHEN direction = 'out' THEN 1 ELSE 0 END)::int                    AS out_count,
          MAX(CASE WHEN direction = 'in'  THEN created_at END)                       AS last_in,
          MAX(CASE WHEN direction = 'out' THEN created_at END)                       AS last_out
        FROM whatsapp_messages
      `;
      const row = Array.isArray(stats) && stats.length > 0 ? stats[0] : null;
      if (row) {
        inCount  = Number(row.in_count  || 0);
        outCount = Number(row.out_count || 0);
        lastIn   = row.last_in  ? new Date(row.last_in).toISOString()  : null;
        lastOut  = row.last_out ? new Date(row.last_out).toISOString() : null;
      }
    } catch {}
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host  = request.headers.get('host') || '';
    const webhookUrl = host ? `${proto}://${host}/api/whatsapp/webhook` : null;
    return NextResponse.json({
      webhookUrl,
      configured: { phoneNumberId: cfgPhone, accessToken: cfgToken, verifyToken: cfgVerify, appSecret: cfgSecret },
      stats: { inboundCount: inCount, outboundCount: outCount, lastInbound: lastIn, lastOutbound: lastOut },
    });
  }

  if (action === 'conversations' || (!action && !phone)) {
    // Optional `?templateName=` filter — restrict to phones that have
    // received at least one outbound message of that template (used by
    // the inbox "Group by template" dropdown).
    const tplFilter = (params.get('templateName') || '').trim();

    // Fetch the list of distinct templates we've ever sent so the UI
    // can render a dropdown without a separate round-trip.
    let templates: string[] = [];
    try {
      const t: any = await sql`
        SELECT DISTINCT template_name FROM whatsapp_messages
        WHERE template_name IS NOT NULL AND template_name <> ''
        ORDER BY template_name ASC
      `;
      templates = (Array.isArray(t) ? t : []).map((r: any) => String(r.template_name));
    } catch {}

    const rows: any = tplFilter
      ? await sql`
          SELECT
            m.phone,
            MAX(m.created_at)                                                   AS last_at,
            (SELECT body FROM whatsapp_messages
               WHERE phone = m.phone
               ORDER BY created_at DESC LIMIT 1)                                 AS last_body,
            (SELECT direction FROM whatsapp_messages
               WHERE phone = m.phone
               ORDER BY created_at DESC LIMIT 1)                                 AS last_direction,
            (SELECT contact_name FROM whatsapp_messages
               WHERE phone = m.phone AND contact_name IS NOT NULL
               ORDER BY created_at DESC LIMIT 1)                                 AS contact_name,
            SUM(CASE WHEN direction = 'in' AND read_by_admin = FALSE THEN 1 ELSE 0 END)::int AS unread
          FROM whatsapp_messages m
          WHERE m.phone IN (
            SELECT DISTINCT phone FROM whatsapp_messages
            WHERE template_name = ${tplFilter}
          )
          GROUP BY m.phone
          ORDER BY last_at DESC
          LIMIT 5000
        `
      : await sql`
          SELECT
            m.phone,
            MAX(m.created_at)                                                   AS last_at,
            (SELECT body FROM whatsapp_messages
               WHERE phone = m.phone
               ORDER BY created_at DESC LIMIT 1)                                 AS last_body,
            (SELECT direction FROM whatsapp_messages
               WHERE phone = m.phone
               ORDER BY created_at DESC LIMIT 1)                                 AS last_direction,
            (SELECT contact_name FROM whatsapp_messages
               WHERE phone = m.phone AND contact_name IS NOT NULL
               ORDER BY created_at DESC LIMIT 1)                                 AS contact_name,
            SUM(CASE WHEN direction = 'in' AND read_by_admin = FALSE THEN 1 ELSE 0 END)::int AS unread
          FROM whatsapp_messages m
          GROUP BY m.phone
          ORDER BY last_at DESC
          LIMIT 5000
        `;
    return NextResponse.json({
      conversations: Array.isArray(rows) ? rows : [],
      templates,
    });
  }

  if (phone) {
    const norm = normalizePhone(phone);
    const limit = Math.min(Math.max(Number(params.get('limit') || 200), 1), 1000);
    const rows: any = await sql`
      SELECT id, wamid, direction, phone, contact_name, message_type, body,
             template_name, status, error, created_at, read_by_admin
      FROM whatsapp_messages
      WHERE phone = ${norm}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    // Side effect: clear unread badge for this conversation.
    try {
      await sql`UPDATE whatsapp_messages
                SET read_by_admin = TRUE
                WHERE phone = ${norm} AND direction = 'in' AND read_by_admin = FALSE`;
    } catch {}
    return NextResponse.json({ messages: Array.isArray(rows) ? rows : [] });
  }

  return NextResponse.json({ error: 'unknown query' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const adminError = await requireAdminSession(request);
  if (adminError) return adminError;
  await ensureTable();

  const params = request.nextUrl.searchParams;
  const action = params.get('action');
  let body: any = {};
  try { body = await request.json(); } catch {}

  if (action === 'mark-read') {
    const phone = normalizePhone(String(body?.phone || ''));
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });
    try {
      await sql`UPDATE whatsapp_messages
                SET read_by_admin = TRUE
                WHERE phone = ${phone} AND direction = 'in' AND read_by_admin = FALSE`;
    } catch {}
    return NextResponse.json({ ok: true });
  }

  // Default: send a free-form text reply.
  const phone = normalizePhone(String(body?.phone || ''));
  const text = String(body?.text || '').trim();
  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: 'invalid phone' }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: 'text too long (max 4096 chars)' }, { status: 400 });
  }

  const result = await sendWhatsAppText(phone, text);
  // Log the outbound regardless of success — failed sends should appear
  // in the conversation thread with their error so the admin can see why.
  try {
    await logOutboundMessage({
      wamid: result.messageId || null,
      phone,
      messageType: 'text',
      body: text,
      templateName: null,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? null : (result.error || `send failed (${result.status})`),
      raw: result,
    });
  } catch (err) {
    console.error('[whatsapp/inbox] logOutbound failed', err);
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        hint: result.hint,
        // Most common reason: outside the 24-h customer service window.
        twentyFourHourWindow:
          /re-?engagement|24[- ]hour|outside.*window|service window/i.test(String(result.error || '')),
      },
      { status: result.status >= 400 ? result.status : 400 },
    );
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
}
