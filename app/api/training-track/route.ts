import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 });

    await sql`CREATE TABLE IF NOT EXISTS training_calendar (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`
      UPDATE training_calendar
      SET data = jsonb_set(
        data,
        '{linkClicks}',
        to_jsonb(COALESCE((data->>'linkClicks')::int, 0) + 1)
      ),
      updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('training-track POST error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
