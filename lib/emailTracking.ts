// Lightweight email open-tracking via 1x1 pixel.
//
// Recipient mail clients that load remote images will fetch the pixel,
// hitting `/api/email-track/[id]`, which logs the open event (timestamp +
// User-Agent + best-effort IP) into the `email_tracking` table. Useful as a
// directional indicator only — see the user-facing notes in the UI for caveats
// (Apple Mail Privacy Protection, image proxies, blocked images, etc.).
import sql from '@/lib/db';

let schemaReady: Promise<void> | null = null;

// Ensures the tracking table exists. Cached after the first call so the
// CREATE only runs once per process.
export function ensureEmailTrackingSchema(): Promise<void> {
    if (!schemaReady) {
        schemaReady = (async () => {
            await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
            await sql`
                CREATE TABLE IF NOT EXISTS email_tracking (
                    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    template        text NOT NULL,
                    recipient_email text NOT NULL,
                    recipient_name  text,
                    subject         text,
                    session_id      text,
                    registrant_id   text,
                    sent_at         timestamptz NOT NULL DEFAULT NOW(),
                    first_opened_at timestamptz,
                    last_opened_at  timestamptz,
                    open_count      integer NOT NULL DEFAULT 0,
                    opens           jsonb NOT NULL DEFAULT '[]'::jsonb
                )
            `;
            await sql`CREATE INDEX IF NOT EXISTS email_tracking_session_idx ON email_tracking (session_id)`;
            await sql`CREATE INDEX IF NOT EXISTS email_tracking_template_idx ON email_tracking (template)`;
        })().catch(err => {
            // Swallow — re-create the promise so a transient DB blip doesn't
            // permanently disable tracking. Log loudly for ops.
            console.error('[EmailTracking] schema init failed:', err);
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

export interface CreateTrackingRowInput {
    template: string;                   // e.g. 'meeting_link_broadcast'
    recipientEmail: string;
    recipientName?: string;
    subject?: string;
    sessionId?: string;                 // training_calendar id
    registrantId?: string;              // training_registrations id
}

// Creates a row and returns the tracking id. Returns null on failure so the
// caller can still send the email without tracking.
export async function createTrackingRow(input: CreateTrackingRowInput): Promise<string | null> {
    try {
        await ensureEmailTrackingSchema();
        const rows = await sql`
            INSERT INTO email_tracking (template, recipient_email, recipient_name, subject, session_id, registrant_id)
            VALUES (
                ${input.template},
                ${input.recipientEmail.toLowerCase()},
                ${input.recipientName || null},
                ${input.subject || null},
                ${input.sessionId || null},
                ${input.registrantId || null}
            )
            RETURNING id
        ` as Array<{ id: string }>;
        return rows?.[0]?.id || null;
    } catch (err) {
        console.error('[EmailTracking] createTrackingRow failed:', err);
        return null;
    }
}

// Builds the absolute URL the recipient's mail client will GET to load the
// pixel. Resolved server-side so it works in dev and production.
export function buildTrackingPixelUrl(trackingId: string): string {
    const base = (process.env.NEXT_PUBLIC_APP_URL
        || process.env.PUBLIC_APP_URL
        || process.env.REPLIT_DEV_DOMAIN
        || '').trim().replace(/\/+$/, '');
    if (!base) return `/api/email-track/${trackingId}`;
    const withProto = /^https?:\/\//i.test(base) ? base : `https://${base}`;
    return `${withProto}/api/email-track/${trackingId}`;
}

// Returns the pixel <img> tag to inject at the end of an HTML email body.
export function buildTrackingPixelTag(trackingId: string): string {
    const src = buildTrackingPixelUrl(trackingId);
    // alt="" + zero dimensions + display:none keeps it invisible in clients
    // that DO show images. Width/height of 1 ensures it renders even when CSS
    // is stripped (Gmail / Outlook), which is when we actually want the load.
    return `<img src="${src}" width="1" height="1" alt="" style="display:block;border:0;outline:none;text-decoration:none;height:1px;width:1px" />`;
}
