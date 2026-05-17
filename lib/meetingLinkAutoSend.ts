// Auto-send "meeting link" hook fired from the training-register POST (free
// path) and PATCH (verify-payment paid path). Reads the per-event toggles
// stored on the calendar row's JSONB, validates the link, and dispatches
// email + WhatsApp sends in the channels the admin chose. The link itself
// lives at training_calendar.data.meetingLink.
//
// Per-event settings (stored on training_calendar.data):
//   autoSendMeetingLinkOnVerify        boolean   default true
//   autoSendMeetingLinkOnFreeRegister  boolean   default true
//   autoSendMeetingLinkChannels        'email' | 'whatsapp' | 'both'  default 'both'
//
// Block-on-missing-link semantics (per user spec):
//   When the relevant toggle is ON and meetingLink is empty/invalid, the
//   caller should treat the registration / verify as blocked and surface
//   the error message returned by `assertMeetingLinkOrError` to the admin
//   or the participant.

import { sendMeetingLinkEmail } from '@/lib/sendEmail';
import { sendWhatsAppTrainingMeetingLink } from '@/lib/sendWhatsApp';

export type AutoSendChannels = 'email' | 'whatsapp' | 'both';

export interface AutoSendSettings {
    onVerify:       boolean;
    onFreeRegister: boolean;
    channels:       AutoSendChannels;
}

// Pulls the three per-event settings off the JSONB blob with sensible
// defaults (ON / both) for events created before this feature shipped.
export function readAutoSendSettings(calData: any): AutoSendSettings {
    const d = calData || {};
    const ch = String(d.autoSendMeetingLinkChannels || 'both');
    return {
        onVerify:       d.autoSendMeetingLinkOnVerify       !== false,
        onFreeRegister: d.autoSendMeetingLinkOnFreeRegister !== false,
        channels:       (ch === 'email' || ch === 'whatsapp') ? ch : 'both',
    };
}

// Returns null when the link is OK to send, or a short user-facing error
// string when the link is missing/invalid. Caller decides whether the
// error should bubble back to admin (verify path) or to participant
// (free-register path).
export function assertMeetingLinkOrError(meetingLink: string | null | undefined): string | null {
    const link = String(meetingLink || '').trim();
    if (!link) {
        return 'Meeting link is not configured for this event. Please add a meeting link to the event before continuing.';
    }
    if (!/^https?:\/\/\S+$/i.test(link)) {
        return 'Meeting link saved on this event is not a valid http(s) URL. Please fix it before continuing.';
    }
    return null;
}

export interface AutoSendDispatchInput {
    channels:     AutoSendChannels;
    to_email:     string | null | undefined;
    to_phone:     string | null | undefined;
    name:         string;
    sessionTitle: string;
    sessionDate:  string;
    sessionTime:  string;
    trainer?:     string | null;
    meetingLink:  string;
    sessionId?:   string;
    registrantId?: string;
    // Surface the existing socials in the email so this doubles as a
    // resource bundle. WhatsApp template is link-only by design.
    whatsappLink?:  string | null;
    instagramLink?: string | null;
    linkedinLink?:  string | null;
}

export interface AutoSendDispatchResult {
    emailAttempted: boolean;
    emailOk:        boolean;
    waAttempted:    boolean;
    waOk:           boolean;
}

// Fire-and-forget dispatcher. Returns a promise so callers can await
// the result for stamping, but errors are caught here so a flaky channel
// can never break a registration / verification request.
export async function dispatchMeetingLinkAutoSend(
    input: AutoSendDispatchInput,
): Promise<AutoSendDispatchResult> {
    const result: AutoSendDispatchResult = {
        emailAttempted: false, emailOk: false,
        waAttempted:    false, waOk:    false,
    };
    const wantEmail = input.channels === 'email'    || input.channels === 'both';
    const wantWa    = input.channels === 'whatsapp' || input.channels === 'both';

    const tasks: Promise<void>[] = [];
    if (wantEmail && input.to_email && /^\S+@\S+\.\S+$/.test(input.to_email)) {
        result.emailAttempted = true;
        tasks.push((async () => {
            try {
                const r = await sendMeetingLinkEmail({
                    to:            input.to_email!,
                    name:          input.name || 'there',
                    sessionTitle:  input.sessionTitle,
                    sessionDate:   input.sessionDate,
                    sessionTime:   input.sessionTime,
                    trainer:       input.trainer || undefined,
                    meetingLink:   input.meetingLink,
                    whatsappLink:  input.whatsappLink  || null,
                    instagramLink: input.instagramLink || null,
                    linkedinLink:  input.linkedinLink  || null,
                    sessionId:     input.sessionId,
                    registrantId:  input.registrantId,
                });
                result.emailOk = !!r.ok;
            } catch (e) {
                console.warn('[meeting-link auto-send] email failed', e);
            }
        })());
    }
    if (wantWa && input.to_phone && String(input.to_phone).replace(/\D/g, '').length >= 7) {
        result.waAttempted = true;
        tasks.push((async () => {
            try {
                result.waOk = await sendWhatsAppTrainingMeetingLink({
                    to:           input.to_phone!,
                    name:         input.name || 'Participant',
                    sessionTitle: input.sessionTitle,
                    sessionDate:  input.sessionDate,
                    sessionTime:  input.sessionTime,
                    meetingLink:  input.meetingLink,
                });
            } catch (e) {
                console.warn('[meeting-link auto-send] WhatsApp failed', e);
            }
        })());
    }
    await Promise.all(tasks);
    return result;
}
