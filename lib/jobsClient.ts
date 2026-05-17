// Browser-only helpers for the public Jobs page.
//
// We deliberately keep the candidate profile, saved-jobs set, and
// application tracker in localStorage rather than the database — the
// public site has no user-account system, so anything tied to a real
// row would need an auth flow we don't have yet. localStorage gives us
// a useful per-device experience today and can graduate to a server
// row the moment job-seeker accounts land.

const SAVED_KEY = 'haccppro:jobs:saved';
const APPS_KEY = 'haccppro:jobs:applications';
const PROFILE_KEY = 'haccppro:jobs:profile';

export interface CandidateProfile {
  name: string;
  email: string;
  phone: string;
  resumeUrl: string;
  headline: string;
}

export interface ApplicationRecord {
  jobId: string;
  jobTitle: string;
  company: string;
  appliedAt: number; // unix ms
  applyUrl: string;
}

const isBrowser = (): boolean => typeof window !== 'undefined';

// ── Saved jobs ─────────────────────────────────────────────────────
export const getSavedJobIds = (): string[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const saveJobIds = (ids: string[]): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event('haccppro:jobs:saved-changed'));
  } catch {}
};

export const toggleSavedJob = (id: string): boolean => {
  const current = getSavedJobIds();
  const idx = current.indexOf(id);
  if (idx >= 0) {
    current.splice(idx, 1);
    saveJobIds(current);
    return false;
  }
  current.unshift(id);
  saveJobIds(current);
  return true;
};

// ── Application tracker ────────────────────────────────────────────
export const getApplications = (): ApplicationRecord[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(APPS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter(
          (x): x is ApplicationRecord =>
            x && typeof x.jobId === 'string' && typeof x.appliedAt === 'number',
        )
      : [];
  } catch {
    return [];
  }
};

export const recordApplication = (rec: ApplicationRecord): void => {
  if (!isBrowser()) return;
  try {
    const existing = getApplications().filter((r) => r.jobId !== rec.jobId);
    existing.unshift(rec);
    window.localStorage.setItem(APPS_KEY, JSON.stringify(existing.slice(0, 200)));
    window.dispatchEvent(new Event('haccppro:jobs:apps-changed'));
  } catch {}
};

export const removeApplication = (jobId: string): void => {
  if (!isBrowser()) return;
  try {
    const remaining = getApplications().filter((r) => r.jobId !== jobId);
    window.localStorage.setItem(APPS_KEY, JSON.stringify(remaining));
    window.dispatchEvent(new Event('haccppro:jobs:apps-changed'));
  } catch {}
};

// ── Candidate profile ──────────────────────────────────────────────
export const getCandidateProfile = (): CandidateProfile => {
  if (!isBrowser()) {
    return { name: '', email: '', phone: '', resumeUrl: '', headline: '' };
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return { name: '', email: '', phone: '', resumeUrl: '', headline: '' };
    const obj = JSON.parse(raw);
    return {
      name: String(obj?.name || ''),
      email: String(obj?.email || ''),
      phone: String(obj?.phone || ''),
      resumeUrl: String(obj?.resumeUrl || ''),
      headline: String(obj?.headline || ''),
    };
  } catch {
    return { name: '', email: '', phone: '', resumeUrl: '', headline: '' };
  }
};

export const saveCandidateProfile = (p: CandidateProfile): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    window.dispatchEvent(new Event('haccppro:jobs:profile-changed'));
  } catch {}
};

// ── Display helpers ────────────────────────────────────────────────

// Deterministic colour from company name so the same brand always
// shows the same avatar tile across the page and across reloads.
const AVATAR_PALETTE = [
  { bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { bg: 'bg-indigo-100', fg: 'text-indigo-700' },
  { bg: 'bg-amber-100', fg: 'text-amber-800' },
  { bg: 'bg-rose-100', fg: 'text-rose-700' },
  { bg: 'bg-sky-100', fg: 'text-sky-700' },
  { bg: 'bg-violet-100', fg: 'text-violet-700' },
  { bg: 'bg-teal-100', fg: 'text-teal-700' },
  { bg: 'bg-orange-100', fg: 'text-orange-700' },
];

export const companyAvatar = (
  company: string,
): { initials: string; bg: string; fg: string } => {
  const words = (company || '?').trim().split(/\s+/).filter(Boolean);
  const initials = (
    (words[0]?.[0] || '?') + (words[1]?.[0] || words[0]?.[1] || '')
  ).toUpperCase();
  let hash = 0;
  for (const ch of company) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const swatch = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return { initials, ...swatch };
};

// Parse "₹18-25 LPA" / "10-14 LPA" / "₹6 LPA" into a numeric range
// (in lakhs). Used by the salary slider on the public page.
export const parseSalaryRange = (
  s: string,
): { min: number; max: number } | null => {
  if (!s) return null;
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
  if (nums.length === 0) return null;
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: nums[0], max: nums[1] };
};

// Highlight occurrences of a query string inside a label. Returns
// React-ready segments so the caller can wrap matched runs in <mark>.
export const highlightSegments = (
  text: string,
  query: string,
): { text: string; match: boolean }[] => {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: { text: string; match: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const found = lower.indexOf(needle, i);
    if (found < 0) {
      out.push({ text: text.slice(i), match: false });
      break;
    }
    if (found > i) out.push({ text: text.slice(i, found), match: false });
    out.push({ text: text.slice(found, found + needle.length), match: true });
    i = found + needle.length;
  }
  return out;
};
