import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Public byte-stream endpoint for WhatsApp Promo Blast header images.
// The id is the row key produced by POST /api/whatsapp/promo-header-images.
// Public so Meta (and the admin's own preview <img>) can fetch it without
// auth — the URL is treated as a publicly fetchable link by the existing
// template send path in lib/whatsappSendCore.ts.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    let rows: any = null;
    try {
      rows = await sql`SELECT mime, data FROM whatsapp_promo_header_images WHERE id = ${id} LIMIT 1`;
    } catch {
      return new NextResponse('Not found', { status: 404 });
    }
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return new NextResponse('Not found', { status: 404 });
    const buffer = Buffer.from(row.data, 'base64');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': row.mime || 'image/jpeg',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('PromoHeaderImages: Failed to fetch:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
