import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// Stable storage for header images attached to a WhatsApp Promo Blast
// (LMS Admin → Promo Blasts → Template mode). Admins upload a JPG/PNG/
// WebP from their device; we persist the bytes in Postgres (mirrors the
// pattern used by /api/academy/news-images) and return a stable, public
// URL like /api/whatsapp/promo-header-images/<id> that can be pasted
// straight into the existing template send path. The send path
// (lib/whatsappSendCore.ts → resolveHeaderImageParam) already absolutises
// relative URLs against the request origin and re-uploads them to Meta
// media, so the URL produced here works without any change downstream.
//
// Reads are public (Meta needs to be able to fetch the image when we
// hand it a publicly fetchable link). Writes are admin-gated via the
// same x-admin-token check used by the rest of the LMS admin surface.

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS whatsapp_promo_header_images (
    id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    byte_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB hard cap (matches news-images)
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requireAdminSession(request);
    if (unauthorized) return unauthorized;
    await ensureTable();

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
    }
    const blob = file as File;
    const mime = (blob.type || '').toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      return NextResponse.json(
        { error: `Unsupported image type. Allowed: ${[...ALLOWED_MIMES].join(', ')}` },
        { status: 400 },
      );
    }
    const ab = await blob.arrayBuffer();
    const byteSize = ab.byteLength;
    if (byteSize === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    if (byteSize > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 413 });
    }
    const base64 = Buffer.from(ab).toString('base64');
    const id = `promo-hdr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await sql`INSERT INTO whatsapp_promo_header_images (id, mime, data, byte_size)
              VALUES (${id}, ${mime}, ${base64}, ${byteSize})`;
    const url = `/api/whatsapp/promo-header-images/${id}`;
    return NextResponse.json({ id, url, byteSize, mime });
  } catch (error) {
    console.error('PromoHeaderImages: Failed to upload:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
