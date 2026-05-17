import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// Read-only history API for the "Promo Blasts" admin page.
//
//   GET /api/whatsapp/promo-blasts
//     → list of past blasts, newest first, with click counts.
//
//   GET /api/whatsapp/promo-blasts?id=123
//     → full detail for one blast: header info + per-recipient
//       outcomes + recent click events.

async function ensureTables() {
  // Idempotent — mirrors the lazy creation in multi-training-promo so
  // this endpoint works even before the first blast is sent.
  try {
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_multi_training_promos (
      id SERIAL PRIMARY KEY,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      training_ids TEXT[] NOT NULL,
      attempted INT NOT NULL,
      succeeded INT NOT NULL,
      failed INT NOT NULL,
      data JSONB
    )`;
    await sql`ALTER TABLE whatsapp_multi_training_promos ADD COLUMN IF NOT EXISTS token TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_promo_clicks (
      id BIGSERIAL PRIMARY KEY,
      token TEXT NOT NULL,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip TEXT,
      ua TEXT,
      referer TEXT
    )`;
  } catch {}
}

export async function GET(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;
  await ensureTables();

  const idParam = req.nextUrl.searchParams.get('id');
  if (idParam) {
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }
    try {
      const rows: any = await sql`
        SELECT b.id, b.sent_at, b.training_ids, b.attempted, b.succeeded,
               b.failed, b.token, b.data,
               COALESCE((SELECT COUNT(*)::int FROM whatsapp_promo_clicks
                         WHERE token = b.token), 0) AS click_count,
               COALESCE((SELECT COUNT(DISTINCT ip)::int FROM whatsapp_promo_clicks
                         WHERE token = b.token AND ip IS NOT NULL), 0) AS unique_ip_clicks
        FROM whatsapp_multi_training_promos b
        WHERE b.id = ${id}
        LIMIT 1
      `;
      const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

      let clicks: any[] = [];
      if (row.token) {
        try {
          const c: any = await sql`
            SELECT id, clicked_at, ip, ua, referer
            FROM whatsapp_promo_clicks
            WHERE token = ${row.token}
            ORDER BY clicked_at DESC
            LIMIT 200
          `;
          clicks = Array.isArray(c) ? c : [];
        } catch {}
      }
      return NextResponse.json({ blast: row, clicks });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
  }

  // List view — last 100 blasts with their click counts.
  try {
    const rows: any = await sql`
      SELECT b.id, b.sent_at, b.training_ids, b.attempted, b.succeeded,
             b.failed, b.token,
             b.data->>'audience' AS audience,
             b.data->>'mode' AS mode,
             b.data->>'namedTemplateName' AS named_template,
             b.data->>'unnamedTemplateName' AS unnamed_template,
             b.data->>'registrationUrl' AS registration_url,
             b.data->>'trackedUrl' AS tracked_url,
             COALESCE((SELECT COUNT(*)::int FROM whatsapp_promo_clicks
                       WHERE token = b.token), 0) AS click_count
      FROM whatsapp_multi_training_promos b
      ORDER BY b.sent_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ blasts: Array.isArray(rows) ? rows : [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
