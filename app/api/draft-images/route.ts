import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS draft_images (
    id VARCHAR PRIMARY KEY,
    draft_id VARCHAR NOT NULL,
    image_data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_draft_images_draft_id ON draft_images (draft_id)`;
  } catch {}
};

export async function POST(req: NextRequest) {
  try {
    await ensureTable();

    const { draftId, imageBase64 } = await req.json();
    
    if (!draftId || !imageBase64) {
      return NextResponse.json({ error: 'Missing draftId or imageBase64' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM draft_images WHERE draft_id = ${draftId} AND md5(image_data) = md5(${imageBase64}) LIMIT 1`;
    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, imageId: existing[0].id, deduplicated: true });
    }

    const imageId = `img-${draftId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await sql`INSERT INTO draft_images (id, draft_id, image_data) VALUES (${imageId}, ${draftId}, ${imageBase64})
      ON CONFLICT (id) DO NOTHING`;

    return NextResponse.json({ success: true, imageId });
  } catch (error) {
    console.error('Failed to save draft image:', error);
    return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const draftId = req.nextUrl.searchParams.get('draftId');
    
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const rows: any[] = await sql`SELECT DISTINCT ON (md5(image_data)) id, image_data FROM draft_images WHERE draft_id = ${draftId} ORDER BY md5(image_data), created_at ASC`;
    const images = ((rows as any) || []).map((r: any) => ({ id: r.id, data: r.image_data }));

    return NextResponse.json(images, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Failed to fetch draft images:', error);
    return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const { imageId, draftId } = await req.json();
    
    if (draftId) {
      await sql`DELETE FROM draft_images WHERE draft_id = ${draftId}`;
    } else if (imageId) {
      await sql`DELETE FROM draft_images WHERE id = ${imageId}`;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete draft image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}
