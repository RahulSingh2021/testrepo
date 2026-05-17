// Normalise image URLs pasted by content authors into a form that
// browsers can actually embed. The most common gotcha is a Google
// Drive "sharing" link like
//
//   https://drive.google.com/file/d/<ID>/view?usp=sharing
//
// which, when used as an <img src>, returns an HTML viewer page
// instead of the image bytes. We rewrite those into Drive's public
// thumbnail endpoint, which serves the actual JPEG/PNG and works
// from any origin (including server-side OG image fetchers).
//
// All other URLs are returned unchanged. Empty / non-string input
// returns an empty string.

const DRIVE_FILE_RE = /^https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_RE = /^https?:\/\/drive\.google\.com\/open\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/;
const DRIVE_UC_RE = /^https?:\/\/drive\.google\.com\/uc\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/;
const DRIVE_THUMB_RE = /^https?:\/\/drive\.google\.com\/thumbnail\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/;
const DRIVE_FOLDER_RE = /^https?:\/\/drive\.google\.com\/drive\/(?:[^/]+\/)*folders\/([a-zA-Z0-9_-]+)/;

// A Drive *folder* link points to a directory, not an image, and cannot
// be embedded as an <img src>. Editors sometimes paste these by mistake;
// callers can use this to surface a clear inline warning instead of
// silently rendering a broken image.
export function isDriveFolderUrl(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return DRIVE_FOLDER_RE.test(input.trim());
}

const extractDriveId = (url: string): string | null => {
  let m: RegExpExecArray | null;
  if ((m = DRIVE_FILE_RE.exec(url))) return m[1];
  if ((m = DRIVE_OPEN_RE.exec(url))) return m[1];
  if ((m = DRIVE_UC_RE.exec(url))) return m[1];
  if ((m = DRIVE_THUMB_RE.exec(url))) return m[1];
  return null;
};

export function normalizeImageUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const url = input.trim();
  if (!url) return '';
  const driveId = extractDriveId(url);
  if (driveId) {
    // sz=w2000 is large enough for hero / OG use without forcing
    // Drive to serve the original (which is rate-limited).
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
  }
  return url;
}

// Walk an HTML string and rewrite every <img src="..."> through
// normalizeImageUrl. Used by the news / tips body sanitiser so a
// Drive share link pasted into the rich-text editor renders for
// public visitors. We only touch the src attribute — alt, title,
// dimensions and surrounding markup pass through unchanged.
export function normalizeHtmlImageSources(html: string): string {
  if (typeof html !== 'string' || !html) return '';
  return html.replace(
    /<img\b([^>]*?)\ssrc=(["'])([^"']+)\2/gi,
    (_match, before: string, quote: string, src: string) => {
      const normalised = normalizeImageUrl(src);
      return `<img${before} src=${quote}${normalised}${quote}`;
    },
  );
}
