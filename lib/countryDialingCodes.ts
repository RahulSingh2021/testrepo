import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js/mobile';

interface CountryEntry {
  code: string;
  iso: CountryCode;
}

const COUNTRY_ENTRIES: Record<string, CountryEntry> = {
  'India': { code: '91', iso: 'IN' },
  'United States': { code: '1', iso: 'US' },
  'United Kingdom': { code: '44', iso: 'GB' },
  'Canada': { code: '1', iso: 'CA' },
  'Australia': { code: '61', iso: 'AU' },
  'UAE': { code: '971', iso: 'AE' },
  'Singapore': { code: '65', iso: 'SG' },
  'Malaysia': { code: '60', iso: 'MY' },
  'Germany': { code: '49', iso: 'DE' },
  'France': { code: '33', iso: 'FR' },
  'Netherlands': { code: '31', iso: 'NL' },
  'Japan': { code: '81', iso: 'JP' },
  'South Korea': { code: '82', iso: 'KR' },
  'China': { code: '86', iso: 'CN' },
  'Brazil': { code: '55', iso: 'BR' },
  'South Africa': { code: '27', iso: 'ZA' },
  'Kenya': { code: '254', iso: 'KE' },
  'Nigeria': { code: '234', iso: 'NG' },
  'Indonesia': { code: '62', iso: 'ID' },
  'Philippines': { code: '63', iso: 'PH' },
  'Thailand': { code: '66', iso: 'TH' },
  'Vietnam': { code: '84', iso: 'VN' },
  'Bangladesh': { code: '880', iso: 'BD' },
  'Sri Lanka': { code: '94', iso: 'LK' },
  'Nepal': { code: '977', iso: 'NP' },
  'Pakistan': { code: '92', iso: 'PK' },
  'Saudi Arabia': { code: '966', iso: 'SA' },
  'Qatar': { code: '974', iso: 'QA' },
  'Bahrain': { code: '973', iso: 'BH' },
  'Oman': { code: '968', iso: 'OM' },
  'Kuwait': { code: '965', iso: 'KW' },
  'New Zealand': { code: '64', iso: 'NZ' },
  'Ireland': { code: '353', iso: 'IE' },
  'Sweden': { code: '46', iso: 'SE' },
  'Norway': { code: '47', iso: 'NO' },
  'Denmark': { code: '45', iso: 'DK' },
  'Finland': { code: '358', iso: 'FI' },
  'Spain': { code: '34', iso: 'ES' },
  'Italy': { code: '39', iso: 'IT' },
  'Portugal': { code: '351', iso: 'PT' },
  'Greece': { code: '30', iso: 'GR' },
};

export const COUNTRY_DIALING_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_ENTRIES).map(([name, { code }]) => [name, code])
);

export const DEFAULT_WA_COUNTRY_CODE = '91';

export const dialingCodeForCountry = (country?: string | null): string | null => {
  if (!country) return null;
  return COUNTRY_DIALING_CODES[country.trim()] ?? null;
};

export const COUNTRY_CODE_OPTIONS: { country: string; code: string }[] = Object
  .entries(COUNTRY_DIALING_CODES)
  .map(([country, code]) => ({ country, code }))
  .sort((a, b) => a.country.localeCompare(b.country));

export interface DetectedDialingCode {
  code: string;
  country: string;
}

const COUNTRY_NAME_BY_ISO: Partial<Record<CountryCode, string>> = Object.fromEntries(
  Object.entries(COUNTRY_ENTRIES).map(([name, { iso }]) => [iso, name])
) as Partial<Record<CountryCode, string>>;

const LIKELY_ISOS: CountryCode[] = Array.from(
  new Set(Object.values(COUNTRY_ENTRIES).map((e) => e.iso))
);

const labelForIsos = (isos: CountryCode[]): string => {
  const names = isos
    .map((iso) => COUNTRY_NAME_BY_ISO[iso])
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return isos.join(' / ');
  // Common compact label for shared codes (e.g. NANP).
  if (names.length === 2 && names.includes('United States') && names.includes('Canada')) {
    return 'United States / Canada';
  }
  return names.join(' / ');
};

const heuristicFallback = (
  original: string,
  defaultCode: string
): DetectedDialingCode | null => {
  // Last-resort heuristic, retained only for shapes libphonenumber refuses to
  // disambiguate from a bare local string. Mirrors prior behaviour.
  if (original.length === 11 && original.startsWith('0')) {
    const second = original[1];
    if (second === '7' || second === '1' || second === '2' || second === '3') {
      return { code: '44', country: 'United Kingdom' };
    }
  }
  const stripped = original.replace(/^0+/, '');
  if (stripped.length === 10) {
    const first = stripped[0];
    if ((first === '2' || first === '3' || first === '4' || first === '5') && defaultCode === '91') {
      return { code: '1', country: 'United States / Canada' };
    }
  }
  return null;
};

export interface PhoneAnalysis {
  detected: DetectedDialingCode | null;
  /**
   * True when libphonenumber rejected the bare local string for every
   * plausible country in `LIKELY_ISOS` AND no heuristic fallback matched.
   * The number is therefore unlikely to dial successfully under any country
   * code, including the admin default.
   */
  invalid: boolean;
}

/**
 * Internal: parse a bare local phone string against every plausible country
 * and return both the best-guess detection and an `invalid` signal for the
 * "matches nowhere" case. Shared by `detectDialingCodeFromPhone` and
 * `resolveWaContact` so the UI can surface a warning without re-running
 * libphonenumber.
 */
export const analyzePhoneNumber = (
  raw: string | null | undefined,
  defaultCode?: string | null
): PhoneAnalysis => {
  if (!raw) return { detected: null, invalid: false };
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.startsWith('+')) return { detected: null, invalid: false };
  const original = trimmed.replace(/\D+/g, '');
  if (!original) return { detected: null, invalid: false };

  const def = (defaultCode || '').replace(/\D+/g, '');

  // Try every likely country; collect those that yield a libphonenumber-valid
  // number when the bare local string is parsed as that country.
  const matchedCodes = new Map<string, CountryCode[]>();
  for (const iso of LIKELY_ISOS) {
    let parsed;
    try {
      parsed = parsePhoneNumberFromString(trimmed, iso);
    } catch {
      parsed = undefined;
    }
    if (parsed && parsed.isValid()) {
      const code = String(parsed.countryCallingCode);
      const list = matchedCodes.get(code) || [];
      list.push(iso);
      matchedCodes.set(code, list);
    }
  }

  if (matchedCodes.size === 0) {
    const heuristic = heuristicFallback(original, def);
    return { detected: heuristic, invalid: heuristic === null };
  }

  // If the default's calling code is among the matches, prefer it (the admin
  // default already resolves to that code at the call site, so we don't need
  // to surface a "detected" override).
  if (def && matchedCodes.has(def)) {
    return { detected: null, invalid: false };
  }

  // No default match. Surface a detection only when exactly one calling code
  // is plausible — multiple plausible codes would be a guess.
  if (matchedCodes.size > 1) {
    return { detected: heuristicFallback(original, def), invalid: false };
  }
  const [code, isos] = matchedCodes.entries().next().value as [string, CountryCode[]];
  return { detected: { code, country: labelForIsos(isos) }, invalid: false };
};

/**
 * Best-effort detection of the most likely country dialing code for a phone
 * number string that has NO explicit international prefix and NO per-record
 * country attached. See `analyzePhoneNumber` for the underlying logic.
 */
export const detectDialingCodeFromPhone = (
  raw: string | null | undefined,
  defaultCode?: string | null
): DetectedDialingCode | null => analyzePhoneNumber(raw, defaultCode).detected;

export type WaCountrySource = 'explicit' | 'country' | 'detected' | 'region-default' | 'default';

export interface ResolvedWaContact {
  url: string | null;
  code: string | null;
  source: WaCountrySource;
  detectedCountry?: string | null;
  /**
   * True when the bare local number didn't match ANY plausible country format
   * (libphonenumber rejected it everywhere). The resolver still falls back to
   * the admin default so a wa.me URL may exist, but admins should be warned
   * because the resulting link is unlikely to dial successfully.
   */
  invalid?: boolean;
}

export const resolveWaContact = (
  raw: string | null | undefined,
  opts: { defaultCode?: string; regionDefaultCode?: string | null; country?: string | null } = {}
): ResolvedWaContact => {
  if (!raw) return { url: null, code: null, source: 'default' };
  const trimmed = String(raw).trim();
  const hasExplicitPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D+/g, '');
  if (!digits) return { url: null, code: null, source: 'default' };

  if (hasExplicitPlus) {
    if (digits.length < 10 || digits.length > 15) {
      return { url: null, code: null, source: 'explicit' };
    }
    return { url: `https://web.whatsapp.com/send?phone=${digits}`, code: null, source: 'explicit' };
  }

  const original = digits;
  digits = digits.replace(/^0+/, '');

  let code: string | null = null;
  let source: WaCountrySource = 'default';
  let detectedCountry: string | null = null;
  let invalid = false;

  if (digits.length === 10) {
    const fromCountry = dialingCodeForCountry(opts.country);
    if (fromCountry) {
      code = fromCountry;
      source = 'country';
    } else {
      const regionDefault = (opts.regionDefaultCode || '').replace(/\D+/g, '');
      const globalDefault = (opts.defaultCode || '').replace(/\D+/g, '') || DEFAULT_WA_COUNTRY_CODE;
      // Detection uses the most specific admin default available so its
      // disambiguation rules (e.g. "10-digit starting with 2 under +91 → NANP")
      // benefit from the regional override too.
      const adminDefault = regionDefault || globalDefault;
      const analysis = analyzePhoneNumber(original, adminDefault);
      if (analysis.detected) {
        code = analysis.detected.code;
        detectedCountry = analysis.detected.country;
        source = 'detected';
      } else if (regionDefault) {
        code = regionDefault;
        source = 'region-default';
      } else {
        code = globalDefault;
        source = 'default';
        invalid = analysis.invalid;
      }
    }
    digits = code + digits;
  }

  if (digits.length < 10 || digits.length > 15) {
    return { url: null, code, source, detectedCountry, invalid };
  }
  return { url: `https://web.whatsapp.com/send?phone=${digits}`, code, source, detectedCountry, invalid };
};

// Re-export for any callers that need to look up a calling code by ISO.
export { getCountryCallingCode };
