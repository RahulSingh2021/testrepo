import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureEmailTrackingSchema } from '@/lib/emailTracking';
import { requireAdminSession } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/email-track/list?sessionId=...&template=...
// Admin-only listing of every tracked email for a session, with open status.
export async function GET(req: NextRequest) {
    const authError = await requireAdminSession(req);
    if (authError) return authError;

    const url = new URL(req.url);
    const sessionId = (url.searchParams.get('sessionId') || '').trim();
    const template  = (url.searchParams.get('template')  || '').trim();
    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    try {
        await ensureEmailTrackingSchema();
        const rows = template
            ? await sql`
                SELECT id, template, recipient_email, recipient_name, subject,
                       sent_at, first_opened_at, last_opened_at, open_count, opens
                FROM email_tracking
                WHERE session_id = ${sessionId} AND template = ${template}
                ORDER BY sent_at DESC
            `
            : await sql`
                SELECT id, template, recipient_email, recipient_name, subject,
                       sent_at, first_opened_at, last_opened_at, open_count, opens
                FROM email_tracking
                WHERE session_id = ${sessionId}
                ORDER BY sent_at DESC
            `;
        const list = (Array.isArray(rows) ? rows : []) as any[];
        const totals = {
            sent:    list.length,
            opened:  list.filter(r => r.open_count > 0).length,
            unopened:list.filter(r => !r.open_count).length,
        };
        return NextResponse.json({ success: true, sessionId, totals, rows: list });
    } catch (err: any) {
        console.error('[EmailTracking] list failed:', err);
        return NextResponse.json({ error: err?.message?.slice(0, 200) || 'List failed.' }, { status: 500 });
    }
}
