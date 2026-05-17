import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS obs_share_links (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const hashPassword = (pw: string) => createHash('sha256').update(pw).digest('hex');

// Single source of truth for "does this observation belong to this
// responsibility?". Keep the matching logic in one place so `verify`
// (read), `close` (write), and any future actions can never disagree —
// otherwise a recipient could view but not close, or worse, close
// observations they shouldn't see.
//
// Strict, normalized exact-match against any of the structured
// responsibility-bearing fields (mainKitchen, departmentName, area, or
// each people[].name). Substring `includes()` was a foot-gun: a token
// scoped to "Kitchen" would also unlock "Hot Kitchen" / "Cold Kitchen"
// etc. — a real cross-tenant leak. Exact match closes that hole.
function normaliseKey(s: any): string {
  return String(s || '').trim().toLowerCase();
}
function matchesAnyResponsibility(obs: any, responsibilities: string[]): boolean {
  const targets = responsibilities.map(normaliseKey).filter(Boolean);
  if (!targets.length) return false;
  const candidates: string[] = [
    normaliseKey(obs?.mainKitchen),
    normaliseKey(obs?.departmentName),
    normaliseKey(obs?.area),
  ];
  if (Array.isArray(obs?.people)) {
    obs.people.forEach((p: any) => candidates.push(normaliseKey(p?.name || p)));
  }
  return targets.some((t) => candidates.includes(t));
}

// Unit-scope check. A share link minted from a specific unit must only
// expose observations belonging to THAT unit, regardless of how many
// other units happen to share the same responsibility name (e.g. every
// hotel has an "Engineering" responsibility — without this, a link
// minted for Rambagh Palace's Engineering owner would also leak Jai
// Mahal Palace's Engineering observations).
//
// Backward-compat: tokens minted before this scoping was introduced
// have no `unitId`. We honour them with the legacy behaviour (no unit
// filter) so live recipients aren't suddenly cut off — admins can
// re-mint to scope. A console.warn flags every legacy hit.
function matchesUnitScope(obs: any, link: any): boolean {
  const linkUnitId = String(link?.unitId || '').trim();
  if (!linkUnitId) return true; // legacy / unscoped link
  const obsUnitId = String(obs?.unitId || '').trim();
  if (obsUnitId) return obsUnitId === linkUnitId;
  // Defensive fallback for legacy observations missing `unitId` but
  // carrying a populated `unitName`. Match by name against the link's
  // recorded unit name; if neither matches, exclude the row (safer to
  // hide than to leak across units).
  const linkUnitName = normaliseKey(link?.unitName);
  const obsUnitName = normaliseKey(obs?.unitName);
  return !!linkUnitName && !!obsUnitName && linkUnitName === obsUnitName;
}
// Resolve the responsibility list for a token. Backward-compatible:
// older tokens persist a single `responsibility` string; newer ones
// (minted by the multi-responsibility blast) persist an array under
// `responsibilities`. Always returns a non-empty array of trimmed
// strings, or an empty array if the token has neither field.
function resolveTokenResponsibilities(linkData: any): string[] {
  if (Array.isArray(linkData?.responsibilities) && linkData.responsibilities.length > 0) {
    return linkData.responsibilities.map((r: any) => String(r || '').trim()).filter(Boolean);
  }
  const single = String(linkData?.responsibility || '').trim();
  return single ? [single] : [];
}

async function safeRows(q: Promise<any>): Promise<any[]> {
  const r = await q;
  return Array.isArray(r) ? r : [];
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');
    const list = searchParams.get('list');

    if (list === '1') {
      // Management endpoint — admin-only. Previously this leaked every
      // share link's `passwordHash` and label to anyone hitting the URL.
      // Now: gated, and the response shape is an explicit allowlist that
      // never includes the password hash.
      const authError = await requireAdminSession(request);
      if (authError) return authError;
      const rows = await safeRows(sql`SELECT id, data, created_at FROM obs_share_links ORDER BY created_at DESC`);
      return NextResponse.json({
        links: rows.map((r) => ({
          id: r.id,
          responsibility: r.data?.responsibility || '',
          label: r.data?.label || r.data?.responsibility || '',
          unitName: r.data?.unitName || '',
          unitId: r.data?.unitId || '',
          createdAt: r.created_at,
        })),
      });
    }

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const rows = await safeRows(sql`SELECT id, data FROM obs_share_links WHERE id = ${token}`);
    if (!rows.length) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });

    const link = rows[0];
    const respList = resolveTokenResponsibilities(link.data);
    return NextResponse.json({
      // Backward-compatible: single `responsibility` is the joined label,
      // newer clients can read the full `responsibilities` array.
      responsibility: respList.join(', '),
      responsibilities: respList,
      label: link.data.label || respList.join(', '),
      // Tells the recipient page whether to show the password prompt or
      // open straight into the observation list. A null/missing hash
      // means the admin minted this link in "open access" mode.
      requiresPassword: !!link.data.passwordHash,
      // Surfaces the link's unit scope so the recipient page can show
      // "Scoped to: <unit>" in the header. Empty for legacy/unscoped.
      unitName: String(link.data.unitName || '').trim(),
      unitId: String(link.data.unitId || '').trim(),
    });
  } catch (err) {
    console.error('obs-share GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { action } = body;

    // Management actions (mint / rotate / bulk-mint share tokens) MUST
    // be admin-only — otherwise an attacker can create a token + their
    // own password for any responsibility name and use it to read
    // matching observations via `verify`. Recipient-facing actions
    // (`verify`, `close`) authenticate on token+password, not session.
    const adminGated = new Set(['create', 'bulk-ensure']);
    if (adminGated.has(action)) {
      const authError = await requireAdminSession(request);
      if (authError) return authError;
    }

    if (action === 'create') {
      const { responsibility, password, label, unitId, unitName } = body;
      if (!responsibility) {
        return NextResponse.json({ error: 'Responsibility is required' }, { status: 400 });
      }
      const token = randomBytes(20).toString('hex');
      // Password is now optional — when omitted the link is "open
      // access" (token-only). The hash field stays null so verify/close
      // can detect the open-access mode without ambiguity.
      const pwHash = password ? hashPassword(password) : null;
      // unitId / unitName scope the link to a single unit so the
      // recipient only sees their own unit's observations. Stored as
      // empty strings (not undefined) when the admin minted at a
      // corporate/regional scope — that case keeps the legacy
      // cross-unit behaviour by intent.
      const data = {
        responsibility,
        label: label || responsibility,
        passwordHash: pwHash,
        unitId: String(unitId || '').trim(),
        unitName: String(unitName || '').trim(),
        createdAt: new Date().toISOString(),
      };
      await sql`INSERT INTO obs_share_links (id, data) VALUES (${token}, ${JSON.stringify(data)}::jsonb)`;
      return NextResponse.json({ token });
    }

    if (action === 'verify') {
      const { token, password } = body;
      if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

      const rows = await safeRows(sql`SELECT id, data FROM obs_share_links WHERE id = ${token}`);
      if (!rows.length) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });

      const link = rows[0];
      // Open-access link (no hash stored) → token alone authenticates.
      // Password-protected link → must match the stored hash.
      if (link.data.passwordHash) {
        if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
        if (link.data.passwordHash !== hashPassword(password)) {
          return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
        }
      }

      const respList = resolveTokenResponsibilities(link.data);
      if (respList.length === 0) {
        return NextResponse.json({ error: 'Token has no responsibilities configured.' }, { status: 500 });
      }

      const linkUnitId = String(link.data?.unitId || '').trim();
      const linkUnitNameLower = String(link.data?.unitName || '').trim().toLowerCase();
      if (!linkUnitId) {
        // Legacy unscoped token — log so we can spot stragglers in
        // production. Re-minting from the admin UI will scope them.
        console.warn('[obs-share] verify: legacy unscoped token in use', {
          token: token.slice(0, 8),
          responsibilities: respList,
        });
      }

      // Per-image size budget: keep generous so real compressed photos
      // (typically 60–250 KB after the client-side ~100 KB target +
      // wiggle room for older records) survive the trip, but still strip
      // pathologically large legacy blobs so a single bad row can't
      // balloon the share-page payload. ~1.5 MB per image, ~6 MB cap on
      // the combined evidence list per observation.
      const MAX_IMG_BYTES = 1_500_000;
      const MAX_EVIDENCE_BYTES_TOTAL = 6_000_000;
      const sanitiseImg = (v: any) =>
        typeof v === 'string' && v.length <= MAX_IMG_BYTES ? v : (typeof v === 'string' && v.startsWith('http') ? v : '');

      // Push filtering AND heavy-image stripping into SQL. Loading every
      // row's full `data` JSONB (with embedded base64 images) used to
      // blow past Neon's 64 MB single-response cap once the observations
      // table grew, returning a 507 that surfaced to recipients as
      // "Invalid Link / Server error". Now:
      //   • The WHERE clause filters by responsibility (across the same
      //     four candidate fields the in-app `matchesAnyResponsibility`
      //     checks) and by unit scope.
      //   • The SELECT projects `data` MINUS the four image-bearing
      //     keys, then re-projects each image as a separate column with
      //     a per-image length cap applied via CASE — oversize blobs
      //     come back as NULL instead of inflating the row.
      // Defence-in-depth: the in-app `matchesAnyResponsibility` /
      // `matchesUnitScope` checks still run on the narrowed result set
      // below, so a future SQL-clause regression can't accidentally
      // widen visibility.
      const respLower = respList.map((r) => r.toLowerCase());
      // Hard cap on rows returned per verify call. Even with image
      // stripping below, a runaway WHERE clause shouldn't be able to
      // produce a multi-thousand-row response. 1000 is well above any
      // realistic single-responsibility caseload and keeps us a safe
      // distance from Neon's 64 MB cap.
      const MAX_ROWS = 1000;
      const obsRows = await safeRows(sql`
        SELECT
          o.id,
          (o.data - 'thumbnail' - 'afterImage' - 'evidence' - 'allEvidence' - 'closureEvidence') AS data,
          CASE WHEN length(o.data->>'thumbnail')  <= ${MAX_IMG_BYTES} THEN o.data->>'thumbnail'  ELSE NULL END AS thumbnail,
          CASE WHEN length(o.data->>'afterImage') <= ${MAX_IMG_BYTES} THEN o.data->>'afterImage' ELSE NULL END AS after_image,
          ae.arr AS all_evidence,
          ce.arr AS closure_evidence
        FROM observations o
        -- Pre-trim allEvidence at the DB layer: type-safe array
        -- unwrap, accept string entries OR objects with a string url,
        -- drop oversize blobs, cap to first 12 elements. Without this
        -- the SQL response itself could exceed 64 MB on a single bad
        -- row even though the data column was stripped of the field.
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('url', url_val)), '[]'::jsonb) AS arr
          FROM (
            SELECT CASE
              WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
              WHEN jsonb_typeof(elem) = 'object' AND jsonb_typeof(elem->'url') = 'string' THEN elem->>'url'
              ELSE NULL
            END AS url_val
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(o.data->'allEvidence') = 'array'
                   THEN o.data->'allEvidence' ELSE '[]'::jsonb END
            ) WITH ORDINALITY AS t(elem, ord)
            ORDER BY ord
            LIMIT 12
          ) sub
          WHERE url_val IS NOT NULL AND length(url_val) <= ${MAX_IMG_BYTES}
        ) ae ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('url', url_val)), '[]'::jsonb) AS arr
          FROM (
            SELECT CASE
              WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
              WHEN jsonb_typeof(elem) = 'object' AND jsonb_typeof(elem->'url') = 'string' THEN elem->>'url'
              ELSE NULL
            END AS url_val
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(o.data->'closureEvidence') = 'array'
                   THEN o.data->'closureEvidence' ELSE '[]'::jsonb END
            ) WITH ORDINALITY AS t(elem, ord)
            ORDER BY ord
            LIMIT 12
          ) sub
          WHERE url_val IS NOT NULL AND length(url_val) <= ${MAX_IMG_BYTES}
        ) ce ON true
        WHERE (
          LOWER(BTRIM(COALESCE(o.data->>'mainKitchen','')))    = ANY(${respLower}::text[])
          OR LOWER(BTRIM(COALESCE(o.data->>'departmentName',''))) = ANY(${respLower}::text[])
          OR LOWER(BTRIM(COALESCE(o.data->>'area','')))           = ANY(${respLower}::text[])
          OR EXISTS (
            -- Type-guard the people field so a misshapen row
            -- (object/string where an array is expected) doesn't crash
            -- the query. Match either object entries (p.name) or
            -- plain-string entries -- mirrors the JS matcher.
            SELECT 1 FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(o.data->'people') = 'array'
                   THEN o.data->'people' ELSE '[]'::jsonb END
            ) AS p
            WHERE LOWER(BTRIM(COALESCE(
              p->>'name',
              CASE WHEN jsonb_typeof(p) = 'string' THEN p #>> '{}' ELSE '' END
            ))) = ANY(${respLower}::text[])
          )
        )
        AND (
          ${linkUnitId} = ''
          OR BTRIM(COALESCE(o.data->>'unitId','')) = BTRIM(${linkUnitId})
          OR (
            BTRIM(COALESCE(o.data->>'unitId','')) = ''
            AND ${linkUnitNameLower} <> ''
            AND LOWER(BTRIM(COALESCE(o.data->>'unitName',''))) = ${linkUnitNameLower}
          )
        )
        ORDER BY o.created_at DESC
        LIMIT ${MAX_ROWS}
      `);

      const filtered = obsRows
        .map((r: any) => {
          const obs: any = { id: r.id, ...(r.data || {}) };
          // Defence-in-depth re-check (see comment above).
          if (!matchesAnyResponsibility(obs, respList) || !matchesUnitScope(obs, link.data)) {
            return null;
          }
          // Re-attach the image fields the SQL projection split out.
          obs.thumbnail  = sanitiseImg(r.thumbnail);
          obs.afterImage = sanitiseImg(r.after_image);

          // Full closure evidence list (mirrors the internal registry's
          // closure detail view). Clamped in count + total bytes.
          if (Array.isArray(r.closure_evidence)) {
            let total = 0;
            obs.closureEvidence = r.closure_evidence
              .map((e: any) => (e && typeof e.url === 'string' ? { url: sanitiseImg(e.url) } : null))
              .filter((e: any) => e && e.url)
              .filter((e: any) => {
                total += e.url.length;
                return total <= MAX_EVIDENCE_BYTES_TOTAL;
              })
              .slice(0, 12);
          }
          // Original-evidence array (`allEvidence`) is what powers the
          // "Initial Evidence" thumbnails on the cards. Apply the same
          // budget so the share page shows everything the internal
          // registry shows.
          if (Array.isArray(r.all_evidence)) {
            let total = 0;
            obs.allEvidence = r.all_evidence
              .map((e: any) => {
                if (typeof e === 'string') return sanitiseImg(e) ? { url: sanitiseImg(e) } : null;
                if (e && typeof e.url === 'string') {
                  const url = sanitiseImg(e.url);
                  return url ? { ...e, url } : null;
                }
                return null;
              })
              .filter(Boolean)
              .filter((e: any) => {
                total += String(e.url).length;
                return total <= MAX_EVIDENCE_BYTES_TOTAL;
              })
              .slice(0, 12);
          }
          obs.evidence = [];
          return obs;
        })
        .filter(Boolean);

      return NextResponse.json({
        responsibility: respList.join(', '),
        responsibilities: respList,
        label: link.data.label || respList.join(', '),
        observations: filtered,
      });
    }

    // Recipient-driven closure from a share link. Rules:
    //   • Token must exist and password must match.
    //   • The observation MUST belong to the same responsibility the
    //     token was minted for (server-side recheck — never trust the id
    //     supplied in the body alone).
    //   • Already-RESOLVED observations are a no-op (idempotent).
    //   • A tracking entry tagged `closedVia: 'share-link'` is appended
    //     so audit trails distinguish recipient-driven closures from
    //     internal ones.
    if (action === 'close') {
      const { token, password, observationId, comments, closedBy, evidenceUrl, allEvidence, asDraft } = body;
      if (!token || !observationId) {
        return NextResponse.json({ error: 'token and observationId are required' }, { status: 400 });
      }
      const cleanComments = String(comments || '').trim().slice(0, 4000);
      const isDraft = !!asDraft;
      // ----- Server-side evidence sanitisation & limits -----
      // The share-link endpoint is reachable by anyone holding a token
      // (some links are unprotected by design), so the closure write path
      // MUST clamp payload size. Without these caps an attacker with a
      // valid token could DoS the JSONB column with multi-MB image
      // strings. Mirrors the client's compressImageForSave (~100 KB
      // target) with generous headroom.
      const MAX_EVIDENCE_COUNT = 12;
      const MAX_EVIDENCE_BYTES = 600_000; // ~600 KB per image (base64)
      const MAX_TOTAL_EVIDENCE_BYTES = 4_000_000; // ~4 MB total per request
      const isAcceptableEvidenceUrl = (u: string) =>
        u.startsWith('data:image/') || u.startsWith('https://') || u.startsWith('/');
      const rawEvidence: any[] = Array.isArray(allEvidence) ? allEvidence : [];
      let totalBytes = 0;
      const closureEvidence: { url: string }[] = [];
      for (const e of rawEvidence) {
        if (!e || typeof e.url !== 'string' || !e.url) continue;
        if (!isAcceptableEvidenceUrl(e.url)) continue;
        if (e.url.length > MAX_EVIDENCE_BYTES) continue;
        totalBytes += e.url.length;
        if (totalBytes > MAX_TOTAL_EVIDENCE_BYTES) break;
        closureEvidence.push({ url: e.url });
        if (closureEvidence.length >= MAX_EVIDENCE_COUNT) break;
      }
      const rawPrimary = typeof evidenceUrl === 'string' ? evidenceUrl : '';
      const primaryEvidence =
        rawPrimary && isAcceptableEvidenceUrl(rawPrimary) && rawPrimary.length <= MAX_EVIDENCE_BYTES
          ? rawPrimary
          : (closureEvidence[0]?.url || null);
      // Closure comments are required for a final Send (the observation
      // is about to flip to RESOLVED and the comment becomes part of the
      // permanent audit trail). Drafts may save evidence-only — same
      // contract as the internal registry's Draft button.
      if (!cleanComments && (isDraft ? closureEvidence.length === 0 && !primaryEvidence : true)) {
        return NextResponse.json({
          error: isDraft
            ? 'Add closure comments or at least one evidence image to save a draft.'
            : 'Closure comments are required.',
        }, { status: 400 });
      }
      const rows = await safeRows(sql`SELECT id, data FROM obs_share_links WHERE id = ${token}`);
      if (!rows.length) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
      const link = rows[0];
      // Same dual-mode check as verify: skip password when the link was
      // minted open-access; enforce it when a hash is on file.
      if (link.data.passwordHash) {
        if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });
        if (link.data.passwordHash !== hashPassword(password)) {
          return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
        }
      }
      const respList = resolveTokenResponsibilities(link.data);
      if (respList.length === 0) {
        return NextResponse.json({ error: 'Token has no responsibilities configured.' }, { status: 500 });
      }

      const obsRows = await safeRows(sql`SELECT id, data FROM observations WHERE id = ${observationId} LIMIT 1`);
      if (!obsRows.length) return NextResponse.json({ error: 'Observation not found' }, { status: 404 });
      const current = { id: obsRows[0].id, ...obsRows[0].data };

      if (!matchesAnyResponsibility(current, respList)) {
        // Defence-in-depth: someone is trying to close an obs that
        // doesn't belong to this share link. Refuse + log.
        console.warn('[obs-share] close: responsibility mismatch', {
          token: token.slice(0, 8),
          responsibilities: respList,
          observationId,
          obsResp: current.mainKitchen || current.departmentName || current.area,
        });
        return NextResponse.json({ error: 'This observation is not assigned to your responsibility.' }, { status: 403 });
      }
      if (!matchesUnitScope(current, link.data)) {
        // The observation matches the responsibility but lives in a
        // different unit than the one the link was scoped to. Refuse +
        // log so cross-unit close attempts are visible.
        console.warn('[obs-share] close: unit scope mismatch', {
          token: token.slice(0, 8),
          linkUnitId: link.data?.unitId,
          observationId,
          obsUnitId: current.unitId,
          obsUnitName: current.unitName,
        });
        return NextResponse.json({ error: 'This observation is not in the unit assigned to your link.' }, { status: 403 });
      }

      const status = String(current.status || 'OPEN').toUpperCase();
      if (status === 'RESOLVED') {
        // Resolved observations are immutable from the public surface —
        // for BOTH Send (idempotent) and Draft. Without this guard, a
        // share-token holder could submit `asDraft: true` and overwrite
        // closureComments / afterImage / closureEvidence / tracking on a
        // finalized record, corrupting the audit trail.
        return NextResponse.json({ ok: true, alreadyResolved: true });
      }

      const now = new Date();
      const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const actor = String(closedBy || '').trim().slice(0, 120) || `Responsibility owner (${link.data.label || respList.join(', ')})`;
      const trackingEntry = {
        id: `t-share-${Date.now()}`,
        label: isDraft ? 'Closure draft saved via share link' : 'Closed via share link',
        user: actor,
        timestamp,
        comments: cleanComments,
        closedVia: 'share-link',
        token: token.slice(0, 8),
        ...(isDraft ? { isDraft: true } : {}),
      };
      const tracking = Array.isArray(current.tracking) ? [...current.tracking, trackingEntry] : [trackingEntry];

      const updated = {
        ...current,
        // Drafts keep the original status; only Send flips to RESOLVED.
        // Mirrors the internal registry's draft semantics exactly.
        ...(isDraft ? {} : { status: 'RESOLVED', closedAt: now.toISOString() }),
        closureComments: cleanComments,
        closedBy: actor,
        // Evidence is stored on `afterImage` (the first/primary thumbnail
        // the cards already render) and `closureEvidence` (the full list
        // for the closure detail view). Empty arrays/null overwrite any
        // prior draft so the latest submission is authoritative.
        afterImage: primaryEvidence ?? current.afterImage ?? null,
        closureEvidence: closureEvidence.length > 0 ? closureEvidence : (current.closureEvidence ?? []),
        lastUpdate: timestamp,
        tracking,
      };
      delete (updated as any).id; // id is the table PK column, not part of data JSONB

      await sql`UPDATE observations SET data = ${JSON.stringify(updated)}::jsonb, updated_at = NOW() WHERE id = ${observationId}`;

      return NextResponse.json({ ok: true, closedAt: isDraft ? null : (updated as any).closedAt, isDraft });
    }

    // Server-side bulk-mint of tokens, used by the "Notify Owners" blast
    // in the Observation Registry. Each group can be either:
    //   • Single-responsibility (legacy):  { responsibility, password, label }
    //   • Multi-responsibility (new):      { responsibilities: string[], key, password, label }
    //     where `key` is a stable identifier (typically the recipient
    //     phone) used both as the response map key and to scope the
    //     "drop prior tokens" cleanup so we don't trample tokens from a
    //     different recipient who happens to own one of the same
    //     responsibilities.
    // Returns { tokens: { [keyOrResponsibility]: token } }.
    if (action === 'bulk-ensure') {
      const groups = Array.isArray(body?.groups) ? body.groups : [];
      const tokens: Record<string, string> = {};
      for (const g of groups) {
        const password = String(g?.password || '').trim();
        // Normalise the responsibility list — accept either field shape.
        const respArr: string[] = Array.isArray(g?.responsibilities)
          ? g.responsibilities.map((r: any) => String(r || '').trim()).filter(Boolean)
          : (() => {
              const single = String(g?.responsibility || '').trim();
              return single ? [single] : [];
            })();
        if (respArr.length === 0) continue;

        const label = String(g?.label || respArr.join(', ')).trim();
        // Stable per-recipient key (phone preferred). Falls back to the
        // joined responsibility list so single-responsibility callers
        // still get back a token map keyed by responsibility name.
        const key = String(g?.key || respArr.join('|')).trim();

        // For multi-responsibility tokens we scope cleanup to the
        // recipient `key` so we don't accidentally evict another
        // recipient's token that overlaps on one responsibility. For
        // legacy single-responsibility callers we keep the old "wipe
        // every token for this responsibility" behaviour.
        try {
          if (Array.isArray(g?.responsibilities)) {
            await sql`DELETE FROM obs_share_links WHERE data->>'recipientKey' = ${key}`;
          } else {
            await sql`DELETE FROM obs_share_links WHERE LOWER(data->>'responsibility') = ${respArr[0].toLowerCase()}`;
          }
        } catch (err) {
          console.warn('[obs-share] bulk-ensure: prior token cleanup failed (non-fatal)', err);
        }

        const token = randomBytes(20).toString('hex');
        // Persist BOTH `responsibility` (joined) and `responsibilities`
        // (array) so older verify/close paths that only know about the
        // string field still degrade gracefully if anything in the
        // codebase hasn't been migrated.
        const data: any = {
          responsibility: respArr.length === 1 ? respArr[0] : respArr.join(', '),
          responsibilities: respArr,
          recipientKey: key,
          label,
          passwordHash: password ? hashPassword(password) : null,
          // Bulk-mint also accepts a per-group unit scope so the
          // "Notify Owners" blast can scope each recipient's link to
          // the correct unit when called with that data.
          unitId: String(g?.unitId || '').trim(),
          unitName: String(g?.unitName || '').trim(),
          createdAt: new Date().toISOString(),
        };
        await sql`INSERT INTO obs_share_links (id, data) VALUES (${token}, ${JSON.stringify(data)}::jsonb)`;
        tokens[key] = token;
      }
      return NextResponse.json({ tokens });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('obs-share POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Admin-only — was previously open to anyone who knew the token,
    // letting an attacker silently revoke every active share link
    // (effective DoS for recipient-driven closures).
    const authError = await requireAdminSession(request);
    if (authError) return authError;
    await ensureTable();
    const token = request.nextUrl.searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
    await sql`DELETE FROM obs_share_links WHERE id = ${token}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('obs-share DELETE error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
