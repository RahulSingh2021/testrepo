import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureEmailTrackingSchema } from '@/lib/emailTracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 43-byte transparent 1x1 GIF used as the open-tracking pixel.
const PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
);

function pixelResponse() {
    // Cache-Control: no-store keeps mail-client image proxies (Gmail, Outlook)
    // from short-circuiting subsequent loads — we want every open we can see.
    return new NextResponse(PIXEL, {
        status: 200,
        headers: {
            'Content-Type':  'image/gif',
            'Content-Length': String(PIXEL.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            Pragma:          'no-cache',
            Expires:         '0',
        },
    });
}

// GET /api/email-track/[id]
// Logs the open then returns a 1x1 transparent GIF. Always returns the pixel —
// failing to log must not break the recipient's email rendering.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return pixelResponse();

    const ua = (req.headers.get('user-agent') || '').slice(0, 500);
    const ip = (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        ''
    ).slice(0, 64);
    const event = JSON.stringify({ at: new Date().toISOString(), ua, ip });

    try {
        await ensureEmailTrackingSchema();
        await sql`
            UPDATE email_tracking
            SET
                open_count      = open_count + 1,
                first_opened_at = COALESCE(first_opened_at, NOW()),
                last_opened_at  = NOW(),
                opens           = opens || ${event}::jsonb
            WHERE id = ${id}
        `;
    } catch (err) {
        console.error('[EmailTracking] open log failed for', id, err);
    }

    return pixelResponse();
}
