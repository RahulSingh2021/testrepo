import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Public byte-stream endpoint for inline images embedded in news article
// bodies. The id is the row key produced by POST /api/academy/news-images.
// Returns 404 if the row is missing so the article reader's <img> simply
// shows broken-image rather than crashing.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    let rows: any = null;
    try {
      rows = await sql`SELECT mime, data FROM academy_news_images WHERE id = ${id} LIMIT 1`;
    } catch {
      // Table does not exist yet (no images have ever been uploaded).
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
    console.error('AcademyNewsImages: Failed to fetch:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
