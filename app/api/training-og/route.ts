import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return new NextResponse('Missing sessionId', { status: 400 });

  try {
    const rows = await sql`SELECT id, data FROM training_calendar WHERE id = ${sessionId}`;
    if (!rows || rows.length === 0) return new NextResponse('Not found', { status: 404 });

    const session = { id: rows[0].id, ...rows[0].data };
    const thumbnailImage = (session as any).thumbnailImage || '';

    if (!thumbnailImage || !thumbnailImage.startsWith('data:image/')) {
      return new NextResponse('No thumbnail', { status: 404 });
    }

    // Parse base64 data URL — accept jpeg, jpg, png, webp, gif
    const match = thumbnailImage.match(/^data:image\/([\w+]+);base64,(.+)$/s);
    if (!match) return new NextResponse('Invalid image data', { status: 400 });

    const rawType = match[1].toLowerCase();
    // Normalise content type — map jpg → jpeg, reject svg (crawlers don't render it)
    const typeMap: Record<string, string> = {
      jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif',
    };
    const mimeSubtype = typeMap[rawType];
    if (!mimeSubtype) return new NextResponse('Unsupported image type', { status: 415 });

    const buffer = Buffer.from(match[2], 'base64');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': `image/${mimeSubtype}`,
        // public: allow CDN + proxy caches (WhatsApp/Facebook crawlers) to cache
        // s-maxage=86400 → cached for 24 h by intermediate proxies
        // stale-while-revalidate=3600 → serve stale while refreshing
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600',
        'Content-Length': String(buffer.length),
        // Wide-open CORS so any crawler can fetch without CORS block
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[training-og] error:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
