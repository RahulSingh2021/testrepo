import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Records and aggregates click events for the public Live Intelligence
// Feed news rows. POST fires from the public home when a reader opens
// an article; GET returns per-article counts (and per-column totals)
// for the admin Content tab.

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_news_clicks (
    id BIGSERIAL PRIMARY KEY,
    post_id TEXT NOT NULL,
    slug TEXT,
    feed_group TEXT,
    lang TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS academy_news_clicks_post_id_idx
            ON academy_news_clicks (post_id)`;
};

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json().catch(() => ({}));
    const postId = typeof body?.post_id === 'string' ? body.post_id.trim() : '';
    if (!postId) {
      return NextResponse.json({ error: 'post_id required' }, { status: 400 });
    }
    const slug = typeof body?.slug === 'string' ? body.slug.slice(0, 200) : '';
    const rawGroup = typeof body?.feed_group === 'string' ? body.feed_group : '';
    const feedGroup = rawGroup === 'regulatory' ? 'regulatory' : 'industry';
    const lang = typeof body?.lang === 'string' ? body.lang.slice(0, 8) : '';
    await sql`INSERT INTO academy_news_clicks (post_id, slug, feed_group, lang)
              VALUES (${postId}, ${slug}, ${feedGroup}, ${lang})`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademyNewsClicks: Failed to record click:', error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

export async function GET() {
  try {
    await ensureTable();
    let rows: any[] = [];
    try {
      const result = await sql`SELECT post_id, feed_group, COUNT(*)::int AS count
                                FROM academy_news_clicks
                                GROUP BY post_id, feed_group`;
      rows = Array.isArray(result) ? result : [];
    } catch {
      rows = [];
    }
    const counts: Record<string, number> = {};
    const totals: Record<string, number> = { regulatory: 0, industry: 0 };
    for (const r of rows) {
      const id = String(r.post_id || '');
      const c = Number(r.count || 0);
      counts[id] = (counts[id] || 0) + c;
      const g = r.feed_group === 'regulatory' ? 'regulatory' : 'industry';
      totals[g] = (totals[g] || 0) + c;
    }
    return NextResponse.json({ counts, totals });
  } catch (error) {
    console.error('AcademyNewsClicks: Failed to fetch counts:', error);
    return NextResponse.json({ counts: {}, totals: { regulatory: 0, industry: 0 } }, { status: 200 });
  }
}
