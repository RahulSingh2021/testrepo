import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { sendMeetingLinkEmail } from '@/lib/sendEmail';
import { sendWhatsAppTrainingMeetingLink } from '@/lib/sendWhatsApp';
import { requireAdminSession } from '@/lib/adminAuth';

// SMTP sends are slow (~1–3s each) and Meta's WhatsApp Cloud API is similar.
// With dozens/hundreds of registrants the total walltime easily blows past
// the platform's default ~60s edge timeout and the client sees an HTTP 504.
// Pin the route to the Node runtime and raise maxDuration so the request
// can finish on long broadcasts.
export const runtime     = 'nodejs';
export const maxDuration = 300; // seconds (5 min)
export const dynamic     = 'force-dynamic';

// POST /api/training-register/broadcast-meeting-link
// Body: {
//   sessionId: string,
//   meetingLink?: string,
//   customNote?: string,
//   onlyUnsent?: boolean,
//   registrantIds?: string[],
//   channels?: 'email' | 'whatsapp' | 'both'   // default: 'email'
// }
//
// Sends the meeting / joining link to every registrant of `sessionId` who has
// the appropriate contact (email for the email channel, mobile/whatsapp for
// the WA channel). Each successful send stamps the registrant's jsonb with
// `meetingLinkEmailSentAt` and/or `meetingLinkWhatsAppSentAt` so we can show
// "already sent" badges and (optionally) skip re-sends.

type SessionData = {
    topic?: string;
    subTopic?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    trainer?: string;
    meetingLink?: string;
    whatsappLink?: string;
    instagramLink?: string;
    linkedinLink?: string;
};

type RegistrantData = {
    name?: string;
    email?: string;
    mobile?: string;
    whatsapp?: string;
    meetingLinkEmailSentAt?: string;
    meetingLinkWhatsAppSentAt?: string;
};

type Channels = 'email' | 'whatsapp' | 'both';

type BroadcastBody = {
    sessionId?:    unknown;
    meetingLink?:  unknown;
    customNote?:   unknown;
    onlyUnsent?:   unknown;
    registrantIds?: unknown;
    channels?:     unknown;
};

export async function POST(request: NextRequest) {
    // Bulk-send + session-mutation endpoint — admin only.
    const authError = await requireAdminSession(request);
    if (authError) return authError;

    try {
        const body = (await request.json().catch(() => ({}))) as BroadcastBody;
        const sessionId    = String(body?.sessionId || '').trim();
        const overrideLink = typeof body?.meetingLink === 'string' ? body.meetingLink.trim() : '';
        const customNote   = typeof body?.customNote === 'string' ? body.customNote.slice(0, 1000) : '';
        const onlyUnsent   = body?.onlyUnsent === true;
        const channelsRaw  = String(body?.channels || 'email').toLowerCase();
        const channels: Channels = (channelsRaw === 'whatsapp' || channelsRaw === 'both')
            ? channelsRaw as Channels
            : 'email';
        const wantEmail = channels === 'email'    || channels === 'both';
        const wantWa    = channels === 'whatsapp' || channels === 'both';

        const registrantIdFilter: Set<string> | null = Array.isArray(body?.registrantIds)
            ? new Set(
                (body.registrantIds as unknown[])
                    .map(v => String(v ?? '').trim())
                    .filter(Boolean),
              )
            : null;
        if (registrantIdFilter && registrantIdFilter.size === 0) {
            return NextResponse.json({ error: 'registrantIds was provided but empty.' }, { status: 400 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const calRes = await sql`SELECT data FROM training_calendar WHERE id = ${sessionId} LIMIT 1`;
        const calRows = (Array.isArray(calRes) ? calRes : []) as Array<{ data: SessionData | null }>;
        if (calRows.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }
        const session: SessionData = calRows[0].data || {};
        const meetingLink = overrideLink || String(session.meetingLink || '').trim();
        if (!meetingLink) {
            return NextResponse.json({
                error: 'No meeting link available — add one to the session or pass `meetingLink` in the request.',
            }, { status: 400 });
        }
        if (!/^https?:\/\/\S+$/i.test(meetingLink)) {
            return NextResponse.json({ error: 'Meeting link must be a valid http(s) URL.' }, { status: 400 });
        }

        if (overrideLink && overrideLink !== session.meetingLink) {
            const patch = JSON.stringify({ meetingLink: overrideLink });
            try {
                await sql`UPDATE training_calendar SET data = data || ${patch}::jsonb WHERE id = ${sessionId}`;
            } catch { /* non-fatal */ }
        }

        const regsRes = await sql`SELECT id, data FROM training_registrations WHERE session_id = ${sessionId}`;
        const regs = (Array.isArray(regsRes) ? regsRes : []) as Array<{ id: string; data: RegistrantData | null }>;

        const sessionTitle = String(session.topic || session.subTopic || 'Training Session');
        const sessionDate  = String(session.date || '');
        const sessionTime  = `${session.startTime || ''}${session.endTime ? ' – ' + session.endTime : ''}`.trim() || '—';
        const trainer      = session.trainer ? String(session.trainer) : undefined;

        // Per-channel counters. The "considered" count is the registrant
        // pool we walked. "sent" counts a row as success when at least one
        // requested channel for it succeeded.
        let sent = 0, skipped = 0, failed = 0;
        let emailSent = 0, emailFailed = 0, emailSkipped = 0;
        let waSent = 0, waFailed = 0, waSkipped = 0;
        const failures: Array<{ id: string; email?: string; phone?: string; name?: string; reason: string }> = [];
        const successes: Array<{ id: string; email: string; phone: string; name: string; channels: string[] }> = [];
        // Dedup by channel-key so duplicate registrations (same email used
        // by 2+ rows, or same phone) only get one send per channel.
        const emailedThisRun = new Set<string>();
        const waedThisRun    = new Set<string>();

        type SendItem = {
            id: string;
            name: string;
            email: string;
            emailKey: string;
            doEmail: boolean;
            phone: string;
            phoneKey: string;
            doWa: boolean;
        };
        const toSend: SendItem[] = [];
        const dupRowStamps: { id: string; email: boolean; wa: boolean }[] = [];

        for (const row of regs) {
            if (registrantIdFilter && !registrantIdFilter.has(String(row.id))) continue;
            const reg: RegistrantData = row.data || {};
            const email = String(reg.email || '').trim();
            const phone = String(reg.mobile || reg.whatsapp || '').trim();
            const emailKey = email.toLowerCase();
            const phoneKey = phone.replace(/\D/g, '');

            // Per-channel decisions.
            let doEmail = false, doWa = false;

            if (wantEmail) {
                if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                    emailSkipped++;
                } else if (!registrantIdFilter && onlyUnsent && reg.meetingLinkEmailSentAt) {
                    emailSkipped++;
                } else if (emailedThisRun.has(emailKey)) {
                    emailSkipped++;
                    dupRowStamps.push({ id: String(row.id), email: true, wa: false });
                } else {
                    emailedThisRun.add(emailKey);
                    doEmail = true;
                }
            }
            if (wantWa) {
                if (!phoneKey || phoneKey.length < 7) {
                    waSkipped++;
                } else if (!registrantIdFilter && onlyUnsent && reg.meetingLinkWhatsAppSentAt) {
                    waSkipped++;
                } else if (waedThisRun.has(phoneKey)) {
                    waSkipped++;
                    dupRowStamps.push({ id: String(row.id), email: false, wa: true });
                } else {
                    waedThisRun.add(phoneKey);
                    doWa = true;
                }
            }

            if (!doEmail && !doWa) {
                skipped++;
                continue;
            }
            toSend.push({
                id: String(row.id),
                name: String(reg.name || '').trim(),
                email, emailKey, doEmail,
                phone, phoneKey, doWa,
            });
        }

        // Stamp duplicates in batches (per channel) so badges stay accurate.
        const dupEmailIds = dupRowStamps.filter(s => s.email).map(s => s.id);
        const dupWaIds    = dupRowStamps.filter(s => s.wa).map(s => s.id);
        if (dupEmailIds.length > 0) {
            const p = JSON.stringify({ meetingLinkEmailSentAt: new Date().toISOString(), meetingLinkEmailLast: meetingLink });
            try { await sql`UPDATE training_registrations SET data = data || ${p}::jsonb WHERE id = ANY(${dupEmailIds})`; } catch {}
        }
        if (dupWaIds.length > 0) {
            const p = JSON.stringify({ meetingLinkWhatsAppSentAt: new Date().toISOString(), meetingLinkWhatsAppLast: meetingLink });
            try { await sql`UPDATE training_registrations SET data = data || ${p}::jsonb WHERE id = ANY(${dupWaIds})`; } catch {}
        }

        // Bounded concurrency: 5 in flight is gentle on SMTP and well under
        // Meta's WhatsApp throughput, while still cutting walltime ~5x.
        const CONCURRENCY = 5;
        const sentEmailIds: string[] = [];
        const sentWaIds:    string[] = [];
        let cursor = 0;
        const worker = async () => {
            while (true) {
                const i = cursor++;
                if (i >= toSend.length) return;
                const item = toSend[i];
                const channelsHit: string[] = [];
                let anyOk = false;
                let anyFail = false;

                if (item.doEmail) {
                    try {
                        const r = await sendMeetingLinkEmail({
                            to: item.email,
                            name: item.name || 'there',
                            sessionTitle, sessionDate, sessionTime, trainer,
                            meetingLink, customNote,
                            whatsappLink:  session.whatsappLink  || null,
                            instagramLink: session.instagramLink || null,
                            linkedinLink:  session.linkedinLink  || null,
                            sessionId, registrantId: item.id,
                        });
                        if (r.ok) {
                            emailSent++; sentEmailIds.push(item.id); channelsHit.push('email'); anyOk = true;
                        } else {
                            emailFailed++; anyFail = true;
                            const m = r.error instanceof Error ? r.error.message : String(r.error || 'Unknown email error');
                            failures.push({ id: item.id, email: item.email, name: item.name, reason: 'email: ' + m.slice(0, 200) });
                        }
                    } catch (e) {
                        emailFailed++; anyFail = true;
                        const m = e instanceof Error ? e.message : String(e);
                        failures.push({ id: item.id, email: item.email, name: item.name, reason: 'email: ' + m.slice(0, 200) });
                    }
                }
                if (item.doWa) {
                    try {
                        const ok = await sendWhatsAppTrainingMeetingLink({
                            to: item.phone,
                            name: item.name || 'Participant',
                            sessionTitle, sessionDate, sessionTime,
                            meetingLink,
                        });
                        if (ok) {
                            waSent++; sentWaIds.push(item.id); channelsHit.push('whatsapp'); anyOk = true;
                        } else {
                            waFailed++; anyFail = true;
                            failures.push({ id: item.id, phone: item.phone, name: item.name, reason: 'whatsapp: send failed (template not approved or invalid number)' });
                        }
                    } catch (e) {
                        waFailed++; anyFail = true;
                        const m = e instanceof Error ? e.message : String(e);
                        failures.push({ id: item.id, phone: item.phone, name: item.name, reason: 'whatsapp: ' + m.slice(0, 200) });
                    }
                }

                if (anyOk) {
                    sent++;
                    successes.push({ id: item.id, email: item.email, phone: item.phone, name: item.name, channels: channelsHit });
                }
                if (!anyOk && anyFail) failed++;
            }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toSend.length) }, worker));

        if (sentEmailIds.length > 0) {
            const p = JSON.stringify({ meetingLinkEmailSentAt: new Date().toISOString(), meetingLinkEmailLast: meetingLink });
            try { await sql`UPDATE training_registrations SET data = data || ${p}::jsonb WHERE id = ANY(${sentEmailIds})`; } catch {}
        }
        if (sentWaIds.length > 0) {
            const p = JSON.stringify({ meetingLinkWhatsAppSentAt: new Date().toISOString(), meetingLinkWhatsAppLast: meetingLink });
            try { await sql`UPDATE training_registrations SET data = data || ${p}::jsonb WHERE id = ANY(${sentWaIds})`; } catch {}
        }

        return NextResponse.json({
            success: true,
            sessionId, sessionTitle, sessionDate, meetingLink, channels,
            totals: {
                considered: regs.length,
                sent, skipped, failed,
                email: { sent: emailSent, failed: emailFailed, skipped: emailSkipped },
                whatsapp: { sent: waSent, failed: waFailed, skipped: waSkipped },
            },
            successes, failures,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Broadcast failed';
        return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
}
