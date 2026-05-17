// Silent auto-send for follow-up observations.
//
// When an observation is marked as a follow-up ("Not Done" / reject), the
// WhatsApp Cloud API alert fires automatically to every contact in the chain
// — without a confirmation popup. The popup code stays intact for the
// new-observation flow; this is a parallel quiet path.
//
// Resolves recipients from BOTH:
//   - Department Contacts tab (manual default contact)
//   - Escalation Matrix (every enrolled L1/L2/L3 user)
// Tries multiple candidate keys (responsibility, departmentName, mainKitchen,
// area, hierarchy parts) because audit-sourced observations don't always
// populate the same field that escalation snapshots are keyed by.

import { getEscalationContactsForResponsibility, getEscalationSnapshot } from './escalationContacts';

// NOTE: The legacy hardcoded "always-CC" list (STATIC_FOLLOWUP_RECIPIENTS) was
// removed. All recipients now come from the Escalation Matrix, which is
// user-managed in the Compliance → Escalation Matrix UI. To add a corporate
// stakeholder to every observation alert at a given site, enroll them in the
// matrix under the relevant responsibility (and level for Option B cumulative
// escalation). This keeps the dev code free of customer-specific data and
// makes the recipient list fully dynamic.

export type AutoSendObservation = {
  kind?: 'new' | 'followup';
  observationText?: string;
  location?: string;
  mainKitchen?: string;
  responsibility?: string;
  status?: string;
  severity?: string;
  sop?: string;
  reportedBy?: string;
  createdDate?: string;
  followUpCount?: number;
  imageUrl?: string;
  // Extra candidate keys to try when looking up contacts
  candidateKeys?: (string | undefined | null)[];
  // Cumulative escalation cap (Option B):
  //   1 = L1 only          (used on initial new observation)
  //   2 = L1 + L2          (used on first follow-up / X click)
  //   3 = L1 + L2 + L3     (used on second+ follow-up)
  // Omitted / 0 / undefined = no cap (legacy behaviour, all levels).
  maxLevel?: number;
};

export type AutoSendResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
  recipients: string[];
  triedKeys: string[];
  matchedKey?: string;
};

const collectRecipientPhones = (
  candidates: (string | undefined | null)[],
  maxLevel?: number,
): { phones: string[]; matchedKey?: string } => {
  const phones = new Set<string>();
  let matchedKey: string | undefined;
  const seen = new Set<string>();

  for (const raw of candidates) {
    const key = (raw || '').trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());

    const before = phones.size;

    // Escalation Matrix is the single source of truth for routing.
    // maxLevel implements Option B cumulative escalation (L1, L1+L2, L1+L2+L3).
    getEscalationContactsForResponsibility(key, maxLevel).forEach((c) => {
      if (c.phone) phones.add(c.phone);
    });

    if (phones.size > before && !matchedKey) matchedKey = key;
  }

  return { phones: Array.from(phones), matchedKey };
};

export const autoSendObservationViaWhatsApp = async (
  observations: AutoSendObservation[],
): Promise<AutoSendResult> => {
  const result: AutoSendResult = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    recipients: [],
    triedKeys: [],
  };

  if (typeof window === 'undefined' || !observations || observations.length === 0) {
    return result;
  }

  // Build the candidate key list across every observation so we try each
  // possible field. Order matters — most specific first.
  const allCandidates: string[] = [];
  observations.forEach((o) => {
    [
      o.responsibility,
      ...(o.candidateKeys || []),
      o.mainKitchen,
      o.location,
    ].forEach((c) => {
      const v = (c || '').trim();
      if (v) allCandidates.push(v);
    });
  });

  result.triedKeys = Array.from(new Set(allCandidates));

  // Take the most permissive maxLevel across the batch (e.g. if any obs in a
  // batched send is at L3, we open the gate to L3 for that batch). Undefined
  // / 0 means "no cap" so we treat that as 999 to win any min/max comparison.
  let effectiveMaxLevel: number | undefined;
  observations.forEach((o) => {
    if (typeof o.maxLevel === 'number' && o.maxLevel > 0) {
      effectiveMaxLevel = Math.max(effectiveMaxLevel ?? 0, o.maxLevel);
    } else {
      effectiveMaxLevel = undefined; // any uncapped obs disables the cap
    }
  });

  const { phones, matchedKey } = collectRecipientPhones(allCandidates, effectiveMaxLevel);

  // Recipients are 100% Escalation-Matrix driven now — no hardcoded numbers.
  const finalPhones = Array.from(new Set(phones));

  result.recipients = finalPhones;
  result.matchedKey = matchedKey;

  if (finalPhones.length === 0) {
    // Helpful diagnostics in DevTools so the user can see why no message was sent
    console.warn('[whatsapp auto-send] no recipients matched. Tried keys:', result.triedKeys, {
      escalationKeys: Object.keys(getEscalationSnapshot()),
    });
    return result;
  }

  // Fire one template message per (observation × recipient). Sequential to
  // stay friendly to Meta's per-number rate limits and to surface errors in
  // order. Errors are collected but never bubble up — silent by design.
  for (const obs of observations) {
    for (const phone of finalPhones) {
      result.attempted += 1;
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            kind: obs.kind === 'followup' ? 'followup' : 'new',
            observation: {
              observationText: obs.observationText,
              location: obs.location,
              mainKitchen: obs.mainKitchen,
              responsibility: matchedKey || obs.responsibility,
              status: obs.status,
              severity: obs.severity,
              sop: obs.sop,
              reportedBy: obs.reportedBy,
              createdDate: obs.createdDate,
              followUpCount: obs.followUpCount,
              imageUrl: obs.imageUrl,
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          result.succeeded += 1;
        } else {
          result.failed += 1;
          const msg = data?.error || `HTTP ${res.status}`;
          result.errors.push(`${phone}: ${msg}${data?.hint ? ' — ' + data.hint : ''}`);
        }
      } catch (err: any) {
        result.failed += 1;
        result.errors.push(`${phone}: ${err?.message || 'network error'}`);
      }
    }
  }

  if (result.errors.length) {
    console.warn('[whatsapp auto-send] partial failures:', result);
  } else {
    console.info('[whatsapp auto-send] sent silently:', result);
  }

  return result;
};
