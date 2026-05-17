import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// Stable storage for inline images embedded in news article bodies.
// The admin Content sub-tab posts compressed base64 here while a writer
// drags or pastes pictures into the WYSIWYG editor; the response gives
// back a stable, public URL like /api/academy/news-images/<id> that
// gets written into the article's HTML instead of a bloated data URI.
// Reads are public (matches the published article surface). Writes are
// admin-gated via the same x-admin-token check used by news-posts.

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_news_images (
    id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    byte_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB hard cap on a single image
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([a-zA-Z0-9./+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requireAdminSession(request);
    if (unauthorized) return unauthorized;
    await ensureTable();
    const body = await request.json();
    const dataUrl: string | undefined = body?.dataUrl;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return NextResponse.json({ error: 'Missing dataUrl' }, { status: 400 });
    }
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid data URL' }, { status: 400 });
    }
    if (!ALLOWED_MIMES.has(parsed.mime)) {
      return NextResponse.json(
        { error: `Unsupported image type. Allowed: ${[...ALLOWED_MIMES].join(', ')}` },
        { status: 400 },
      );
    }
    const byteSize = Math.ceil((parsed.base64.length * 3) / 4);
    if (byteSize > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 413 });
    }
    const id = `news-img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await sql`INSERT INTO academy_news_images (id, mime, data, byte_size)
              VALUES (${id}, ${parsed.mime}, ${parsed.base64}, ${byteSize})`;
    const url = `/api/academy/news-images/${id}`;
    return NextResponse.json({ id, url });
  } catch (error) {
    console.error('AcademyNewsImages: Failed to upload:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
