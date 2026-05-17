import { NextRequest, NextResponse } from 'next/server';
import { predictNutritionWithAI } from '@/lib/aiNutritionPredict';

// Thin wrapper around the Gemini-backed predictor in `lib/aiNutritionPredict`.
// Used by the Recipe Studio "unknown ingredient add" path so users see
// approximate nutrition within ~1s while the precise USDA/FSANZ lookup
// continues in the background. Fail-soft: returns 503 / 500 with no
// further detail so callers can silently skip the pre-fill.

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const name = body && typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    if (name.length > 200) {
      return NextResponse.json({ error: 'name too long' }, { status: 400 });
    }

    // Hard wall-clock cap so a slow Gemini call can't block the user
    // forever. The client also enforces its own ~4s timeout — this is a
    // server-side belt to ensure the route never holds a connection open.
    const timeoutMs = 8000;
    const result = await Promise.race([
      predictNutritionWithAI(name),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!result) {
      return NextResponse.json({ error: 'AI_UNAVAILABLE' }, { status: 503 });
    }
    return NextResponse.json({ prediction: result });
  } catch (error: any) {
    console.error('AI nutrition predict error:', error);
    // Return a generic message so internal exception details (paths,
    // SDK internals, etc.) don't leak to clients. Full error is logged
    // server-side above for diagnosis.
    return NextResponse.json({ error: 'AI predict failed' }, { status: 500 });
  }
}
