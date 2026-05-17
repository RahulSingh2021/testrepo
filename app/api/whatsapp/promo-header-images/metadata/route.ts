import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { isSafeUrl } from '@/lib/newsThumbnail';

// Server-side metadata lookup for the WhatsApp Promo Blast header image.
//
// The LMS Admin preview shows file size + pixel dimensions next to the
// header thumbnail (Task #210). Dimensions can always be measured in the
// browser via <img>.naturalWidth/Height, but byte size for *external*
// pasted URLs cannot be reliably read from the browser: most third-party
// image hosts do not return CORS-permissive headers for HEAD requests
// even though the <img> renders fine. To work around that, the admin UI
// asks this endpoint to look up the byte size on the server (no CORS).
//
// For our own uploaded URLs (/api/whatsapp/promo-header-images/<id>) we
// return the persisted byte_size directly from the DB. For any other URL
// we issue a server-side HEAD (then a ranged GET fallback if HEAD does
// not return Content-Length) and pass the number back. The endpoint
// always returns 200 with `{ byteSize: number | null }` so the client
// can show a definite "size unknown" terminal state instead of spinning.
//
// Admin-gated since it acts as a small outbound HTTP proxy.

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const url = request.nextUrl.searchParams.get('url') || '';
  if (!url.trim()) {
    return NextResponse.json({ byteSize: null, error: 'Missing url' }, { status: 400 });
  }

  // Local upload: read byte_size from DB.
  const localMatch = url.match(/^\/?api\/whatsapp\/promo-header-images\/([^/?#]+)/);
  if (localMatch) {
    try {
      const id = localMatch[1];
      const rows: any = await sql`SELECT byte_size FROM whatsapp_promo_header_images WHERE id = ${id} LIMIT 1`;
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      const n = row?.byte_size;
      const byteSize = typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
      return NextResponse.json({ byteSize });
    } catch {
      return NextResponse.json({ byteSize: null });
    }
  }

  // External URL: must be absolute http(s) AND not point at a private/
  // loopback/link-local host. isSafeUrl reuses the same SSRF guard used
  // by lib/newsThumbnail (blocks localhost, .local/.internal, RFC1918
  // CIDRs, link-local, multicast, IPv6 loopback/ULA/link-local, etc.).
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ byteSize: null, error: 'Invalid url' }, { status: 400 });
  }
  if (!isSafeUrl(parsed.toString())) {
    return NextResponse.json({ byteSize: null, error: 'Blocked url' }, { status: 400 });
  }

  const readContentLength = (h: Headers) => {
    const v = h.get('content-length');
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // Best-effort fetch with a short timeout so a slow host can't hang the UI.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    let byteSize: number | null = null;
    try {
      // redirect: 'manual' so a 30x to a private/internal host can't
      // bypass the isSafeUrl check above. Non-2xx responses simply
      // yield no size and we fall through to the GET attempt.
      const head = await fetch(parsed.toString(), { method: 'HEAD', signal: ctrl.signal, redirect: 'manual' });
      if (head.ok) byteSize = readContentLength(head.headers);
    } catch { /* fall through to GET */ }

    if (byteSize == null) {
      // Some CDNs don't honour HEAD or omit Content-Length on HEAD.
      // Try a ranged GET — most servers return Content-Range with the
      // total size, even if Content-Length itself reflects the range.
      try {
        const rg = await fetch(parsed.toString(), {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          signal: ctrl.signal,
          redirect: 'manual',
        });
        if (rg.ok || rg.status === 206) {
          const cr = rg.headers.get('content-range');
          if (cr) {
            const m = cr.match(/\/\s*(\d+)\s*$/);
            if (m) {
              const n = parseInt(m[1], 10);
              if (Number.isFinite(n) && n > 0) byteSize = n;
            }
          }
          if (byteSize == null) byteSize = readContentLength(rg.headers);
        }
        // Drain to release the connection.
        try { await rg.body?.cancel(); } catch { /* ignore */ }
      } catch { /* give up; return null */ }
    }

    return NextResponse.json({ byteSize });
  } finally {
    clearTimeout(t);
  }
}
