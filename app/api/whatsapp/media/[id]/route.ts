import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

const GRAPH_VERSION = 'v21.0';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminError = await requireAdminSession(request);
  if (adminError) return adminError;

  const { id } = await params;
  const msgId = Number(id);
  if (!Number.isFinite(msgId) || msgId <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  let row: any = null;
  try {
    const r: any = await sql`
      SELECT id, message_type, raw
      FROM whatsapp_messages
      WHERE id = ${msgId}
      LIMIT 1
    `;
    row = Array.isArray(r) && r.length > 0 ? r[0] : null;
  } catch (err) {
    console.error('[whatsapp/media] db lookup failed', err);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const raw = row.raw || {};
  const type = String(row.message_type || raw.type || '');
  // The media descriptor lives under one of these keys depending on type.
  const desc =
    raw[type] ||
    raw.image || raw.video || raw.audio || raw.document || raw.sticker;
  const mediaId = desc && (desc.id || desc.media_id);
  if (!mediaId) {
    return NextResponse.json({ error: 'no media id on this message' }, { status: 400 });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'WHATSAPP_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  // Step 1 — resolve the temporary signed download URL for this media
  // ID. Meta's response is JSON: { url, mime_type, sha256, file_size, ... }.
  // The URL is valid for ~5 minutes and must be fetched with the same
  // bearer token (it's NOT a public URL).
  let metaUrl = '';
  // Stored `desc.mime_type` is only used as a final fallback below — we
  // prefer the upstream Content-Type (and Meta's lookup mime_type) so a
  // spoofed webhook payload can't trick the admin browser into
  // mis-rendering a download.
  let lookupMime = '';
  try {
    const lookupRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(String(mediaId))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!lookupRes.ok) {
      const txt = await lookupRes.text().catch(() => '');
      console.error('[whatsapp/media] meta lookup failed', lookupRes.status, txt.slice(0, 300));
      return NextResponse.json({ error: `meta lookup ${lookupRes.status}` }, { status: 502 });
    }
    const lookup: any = await lookupRes.json();
    metaUrl = String(lookup.url || '');
    if (lookup.mime_type) lookupMime = String(lookup.mime_type);
    if (!metaUrl) return NextResponse.json({ error: 'no media url returned' }, { status: 502 });
  } catch (err: any) {
    console.error('[whatsapp/media] meta lookup threw', err);
    return NextResponse.json({ error: err?.message || 'lookup failed' }, { status: 502 });
  }

  // SSRF guard: even though `metaUrl` came from a Graph API response we
  // authenticated to, the response is JSON and could in principle return
  // any URL. Restrict to Meta's CDN / Facebook hosts so a compromised or
  // mis-routed lookup can't be used to fetch arbitrary internal URLs.
  let parsed: URL;
  try { parsed = new URL(metaUrl); }
  catch { return NextResponse.json({ error: 'invalid media url' }, { status: 502 }); }
  const host = parsed.hostname.toLowerCase();
  const allowedHost =
    parsed.protocol === 'https:' && (
      host === 'lookaside.fbsbx.com' ||
      host.endsWith('.fbcdn.net') ||
      host.endsWith('.facebook.com') ||
      host.endsWith('.whatsapp.net')
    );
  if (!allowedHost) {
    console.error('[whatsapp/media] refusing non-Meta media host', host);
    return NextResponse.json({ error: 'unexpected media host' }, { status: 502 });
  }

  // Step 2 — fetch the actual bytes and stream them back. Using a
  // streaming response avoids loading large attachments into memory.
  let upstream: Response;
  try {
    upstream = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err: any) {
    console.error('[whatsapp/media] media fetch threw', err);
    return NextResponse.json({ error: err?.message || 'fetch failed' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `media fetch ${upstream.status}` }, { status: 502 });
  }

  const headers = new Headers();
  // Trust order for Content-Type:
  //   1. upstream response header (most authoritative — what the actual
  //      bytes really are)
  //   2. Graph lookup `mime_type` (Meta-controlled metadata)
  //   3. webhook payload `desc.mime_type` (could be spoofed if signature
  //      verification is disabled — last resort)
  //   4. application/octet-stream
  const upstreamType = upstream.headers.get('content-type') || '';
  const finalType =
    upstreamType ||
    lookupMime ||
    String(desc.mime_type || '') ||
    'application/octet-stream';
  headers.set('Content-Type', finalType);
  // Defence-in-depth: stop the browser from sniffing an arbitrary type
  // out of the bytes (e.g. detecting an HTML payload inside a doc and
  // executing it as a page).
  headers.set('X-Content-Type-Options', 'nosniff');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);
  // Cache aggressively in the admin's browser — the underlying media
  // is immutable (Meta media IDs never change content) and the proxy
  // endpoint itself is admin-gated, so there's no leakage risk.
  headers.set('Cache-Control', 'private, max-age=86400, immutable');

  // Friendly filename for documents → enables the browser's "Save As"
  // dialog to use the original name. Inline for images/audio/video so
  // they render in <img>/<audio>/<video> tags instead of downloading.
  const filename = String(desc.filename || '').replace(/[\r\n"\\]/g, '').slice(0, 200);
  const isDoc = type === 'document';
  if (isDoc && filename) {
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  } else if (isDoc) {
    headers.set('Content-Disposition', 'attachment');
  } else {
    headers.set('Content-Disposition', 'inline');
  }

  return new NextResponse(upstream.body, { status: 200, headers });
}
