// Mirror of the EscalationMatrix → flat contact lookup for the WhatsApp
// observation confirm popup. EscalationMatrix is a deeply nested entity
// override map that requires the full entities[] tree to resolve, but the
// popup runs as a global singleton without that context. So we keep a
// flattened snapshot in localStorage that the popup can read instantly.

export type EscalationContact = {
  userId: string;
  name: string;
  phone: string;     // digits-only, country code first, no '+'
  email?: string;
  level: number;     // 1, 2, 3
  group: string;     // group name within the level (e.g. "Hot Kitchen")
  department: string; // original department key (matrix row)
};

const STORAGE_KEY = 'haccp_escalation_contacts_v1';

const normalize = (key: string) => (key || '').trim().toLowerCase();

type Snapshot = Record<string, EscalationContact[]>;

export const getEscalationSnapshot = (): Snapshot => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveEscalationSnapshot = (snapshot: Snapshot) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota or serialization — fail silent, popup will just show no contacts */
  }
};

export const getEscalationContactsForResponsibility = (
  responsibility: string | null | undefined,
  maxLevel?: number, // optional cap: only include contacts at level <= maxLevel (cumulative escalation, Option B)
): EscalationContact[] => {
  if (!responsibility) return [];
  const snap = getEscalationSnapshot();
  const direct = snap[normalize(responsibility)] || [];
  const cap = typeof maxLevel === 'number' && maxLevel > 0 ? maxLevel : Infinity;
  // Dedupe by userId — same person enrolled at multiple levels appears once,
  // but their lowest level is preserved (more urgent contact first).
  const seen = new Map<string, EscalationContact>();
  direct.forEach((c) => {
    if (!c.phone) return;
    if (c.level > cap) return; // respect escalation cap
    const existing = seen.get(c.userId);
    if (!existing || c.level < existing.level) seen.set(c.userId, c);
  });
  return Array.from(seen.values()).sort((a, b) => a.level - b.level);
};
