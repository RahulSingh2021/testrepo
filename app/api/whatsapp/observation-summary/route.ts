import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { sendWhatsAppText, sendWhatsAppTemplateBody } from '@/lib/whatsappSendCore';

// Per-recipient observation summary blast — multi-responsibility aware.
//
// Input shape (per group, one per responsibility row in the modal):
//   { responsibility, label, password, openCount, closedCount,
//     avgOpenAgeHours, avgCloseTimeHours, sample[], recipients[] }
//
// What the server does:
//   1. Pivot by *recipient phone* across all incoming groups, so a
//      contact who owns multiple responsibilities receives ONE message
//      listing every responsibility (each as its own line block) rather
//      than N independent messages.
//   2. Mint (or rotate) ONE share token per consolidated recipient,
//      whose `responsibilities` array covers every responsibility that
//      recipient owns. Older single-responsibility tokens for the same
//      recipient (matched by `recipientKey` = phone) are evicted first.
//   3. Build the deep link `${baseUrl}/obs-share/<token>` and a
//      multi-line "{{2}}" status block:
//        • openCount > 0 → "*<Label>* — N open · M closed"
//                          "⏱ Avg open: X · Avg closure: Y"
//        • openCount = 0 → "👏 Thank you, <Label> Department, for
//                           promptly closing all the food-safety
//                           observation(s)"
//      Blocks are joined with a blank line.
//   4. Send via the Meta-approved `observation_summary_v1` template
//      using the new 3-variable body:
//        Header  {{1}} = Unit Name
//        Body    {{1}} = Recipient name (or fallback)
//                {{2}} = the multi-responsibility status block
//                {{3}} = per-recipient secure share link
//      Or as free-form text (24h window only) using the same vars
//      via {name}/{block}/{link}/{unitName} placeholders.

// Two templates now coexist:
//   • DEFAULT_TEMPLATE_SINGLE — used when a recipient owns exactly ONE
//     responsibility. Body has 5 vars: [label, openCount, avgOpenAge,
//     avgCloseTime, link]. Header {{1}} = unit name.
//   • DEFAULT_TEMPLATE_MULTI  — used when a recipient owns 2+
//     responsibilities. Body has 3 vars: [recipientName, multi-line
//     status block, link]. Header {{1}} = unit name.
// The caller can override either via `singleTemplateName` /
// `multiTemplateName` in the request body. Legacy callers that send
// only `templateName` get it applied to BOTH (back-compat).
const DEFAULT_TEMPLATE_SINGLE = 'observation_summary_v1';
const DEFAULT_TEMPLATE_MULTI = 'all_observation_summary_v1';
const DEFAULT_LANGUAGE = 'en';
const hashPassword = (pw: string) => createHash('sha256').update(pw).digest('hex');

const normalizePhone = (raw: any): string | null => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

type Recipient = { phone: string; name?: string };
type Group = {
  responsibility: string;
  label?: string;
  password: string;
  openCount: number;
  closedCount?: number;
  sample?: string[];
  // Per-responsibility ageing metrics (computed client-side and passed
  // through). Server only formats them; the source of truth is the
  // browser, since it has the merged observations in memory.
  avgOpenAgeHours?: number;
  avgCloseTimeHours?: number | null;
  recipients: Recipient[];
};

// Mirrors components/ObservationRegistry.tsx::formatDurationHours so
// the WhatsApp message reads identically to the modal preview.
function formatDurationHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h) || h < 0) return 'no history';
  if (h < 1) {
    const m = Math.max(1, Math.round(h * 60));
    return `${m}m`;
  }
  if (h < 24) return `${Math.round(h)}h`;
  const days = Math.floor(h / 24);
  const remH = Math.round(h - days * 24);
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

// Per-responsibility block emitted into the {{2}} variable. Stays
// short on purpose so the whole block fits within Meta's ~1024 char
// per-variable limit even when a recipient owns many responsibilities.
type PivotItem = {
  responsibility: string;
  label: string;
  openCount: number;
  closedCount: number;
  avgOpenAge: string;
  avgCloseTime: string;
};
function buildResponsibilityBlock(items: PivotItem[]): string {
  return items
    .map((it) => {
      if (it.openCount > 0) {
        return [
          `*${it.label}* — ${it.openCount} open · ${it.closedCount} closed`,
          `⏱ Avg open: ${it.avgOpenAge} · Avg closure: ${it.avgCloseTime}`,
        ].join('\n');
      }
      return `👏 Thank you, ${it.label} Department, for promptly closing all the food-safety observation(s)`;
    })
    .join('\n\n');
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;

  let body: any = {};
  try { body = await req.json(); } catch {}

  const groups: Group[] = Array.isArray(body?.groups) ? body.groups : [];
  if (!groups.length) {
    return NextResponse.json({ error: 'No groups supplied' }, { status: 400 });
  }
  const dryRun = body?.dryRun === true;
  const mode: 'template' | 'text' = body?.mode === 'text' ? 'text' : 'template';
  // Per-recipient template selection — single-resp recipients get the
  // 5-var legacy template, multi-resp recipients get the 3-var
  // consolidated template. Legacy callers pass `templateName` only,
  // which we apply to both for backward compatibility.
  const legacyTemplateName = String(body?.templateName || '').trim();
  const singleTemplateName = (
    String(body?.singleTemplateName || '').trim() ||
    legacyTemplateName ||
    DEFAULT_TEMPLATE_SINGLE
  );
  const multiTemplateName = (
    String(body?.multiTemplateName || '').trim() ||
    legacyTemplateName ||
    DEFAULT_TEMPLATE_MULTI
  );
  const languageCode = String(body?.languageCode || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
  const rawFallback = String(body?.nameFallback ?? 'there').trim();
  const nameFallback = rawFallback.length > 0 ? rawFallback : 'there';
  // Recipients of these WhatsApp links almost always view them outside
  // the app on a phone they've never signed into the dashboard with —
  // so a Replit preview origin would land them on a 401 page. Force the
  // shared link to the public production domain (overridable per
  // deployment via NEXT_PUBLIC_APP_URL).
  const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://haccppro.in').replace(/\/$/, '');
  const looksLikePublicHost = (u: string) => /^https?:\/\/[^/]*haccppro\.(in|com)/i.test(u);
  const clientBaseUrl = String(body?.baseUrl || '').replace(/\/$/, '');
  const baseUrl = looksLikePublicHost(clientBaseUrl) ? clientBaseUrl : PUBLIC_SITE_URL;
  // Header variable {{1}} for the observation_summary_v1 template — the
  // unit name shown in "Pending Observation Alert of <Unit Name>". The
  // client computes this from the active scope; if it's missing for any
  // reason we fall back to a generic label so Meta never receives an
  // empty header variable (error 132001).
  const unitName = String(body?.unitName || '').trim() || 'All Units';
  // Unit-scope for the share tokens minted by this blast. The header
  // `unitName` above is just a Meta template variable and may have
  // been replaced with "All Units" or a regional/corporate name when
  // the admin minted from above-unit scope. The scope fields below
  // are the AUTHORITATIVE unit identity stored on each token so
  // verify/close in /api/obs-share can filter observations to only
  // this unit. Empty string = legacy cross-unit behaviour by intent.
  const scopeUnitId = String(body?.scopeUnitId || '').trim();
  const scopeUnitName = String(body?.scopeUnitName || '').trim();
  // Free-form text mode template. Supports {name}, {block}, {link},
  // {password}, {unitName}. Per-responsibility info lives entirely
  // inside {block} now — older {responsibility}/{count}/{avgOpenAge}
  // placeholders are still substituted with the FIRST item's values
  // for backward compatibility with old admin-edited templates.
  const messageTemplate = String(
    body?.messageTemplate ||
      '⚠️ Pending Observation Alert of {unitName}\n\nHello {name},\n\nHere is the current food-safety observation status:\n\n{block}\n\n📋 Please review and close pending items here:\n{link}\n\nThank you',
  );
  // Single password applied to ALL minted tokens this blast. The first
  // non-empty per-group password wins (back-compat: older callers send
  // a password per group). When every password is empty the link is
  // open-access.
  const blastPassword = (() => {
    for (const g of groups) {
      const p = String(g?.password || '').trim();
      if (p) return p;
    }
    return '';
  })();
  const isOpenAccess = !blastPassword;

  // ---------------------------------------------------------------
  // Pivot by recipient phone. Multiple groups → multiple items per
  // recipient → ONE consolidated message per recipient.
  // ---------------------------------------------------------------
  type RecipientBucket = {
    phone: string;
    name: string;
    items: PivotItem[];
    // Set of responsibility strings (raw, pre-label) — used when
    // minting the share token so verify/close can match against any of
    // them.
    responsibilities: string[];
  };
  const buckets = new Map<string, RecipientBucket>();
  const skippedGroups: any[] = [];

  for (const g of groups) {
    const responsibility = String(g?.responsibility || '').trim();
    const label = String(g?.label || responsibility).trim();
    const openCount = Number(g?.openCount || 0);
    const closedCount = Number(g?.closedCount || 0);
    const recipients: Recipient[] = Array.isArray(g?.recipients) ? g.recipients : [];
    const avgOpenAge = formatDurationHours(typeof g?.avgOpenAgeHours === 'number' ? g.avgOpenAgeHours : null);
    const avgCloseTime = formatDurationHours(typeof g?.avgCloseTimeHours === 'number' ? g.avgCloseTimeHours : null);

    if (!responsibility) {
      skippedGroups.push({ responsibility, error: 'Missing responsibility — skipped.' });
      continue;
    }
    if (recipients.length === 0) {
      skippedGroups.push({ responsibility, error: 'No recipients — skipped.' });
      continue;
    }

    for (const r of recipients) {
      const phone = normalizePhone(r?.phone);
      if (!phone) continue;
      const safeName = (() => {
        const n = String(r?.name || '').trim();
        return n.length > 0 ? n : nameFallback;
      })();
      let bucket = buckets.get(phone);
      if (!bucket) {
        bucket = { phone, name: safeName, items: [], responsibilities: [] };
        buckets.set(phone, bucket);
      } else if (
        // Name-conflict resolution: when the same phone appears in two
        // groups with different names (e.g. one group has the real
        // contact name, another only the fallback), prefer the
        // non-fallback name. This avoids sending "Hello there" when we
        // do have a real name elsewhere in the payload.
        bucket.name === nameFallback &&
        safeName !== nameFallback
      ) {
        bucket.name = safeName;
      }
      // Don't double-add the same responsibility for the same recipient
      // (would happen if the admin somehow listed the same row twice).
      if (!bucket.responsibilities.some((x) => x.toLowerCase() === responsibility.toLowerCase())) {
        bucket.responsibilities.push(responsibility);
        bucket.items.push({ responsibility, label, openCount, closedCount, avgOpenAge, avgCloseTime });
      }
    }
  }

  const totals = {
    groupCount: groups.length,
    recipientCount: buckets.size,
    sent: 0,
    failed: 0,
  };
  const perRecipient: any[] = [];

  await sql`CREATE TABLE IF NOT EXISTS obs_share_links (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  for (const bucket of buckets.values()) {
    const { phone, name, items, responsibilities } = bucket;
    const block = buildResponsibilityBlock(items);
    const joinedLabel = items.map((i) => i.label).join(', ');

    // Mint / rotate one token per recipient covering ALL their
    // responsibilities. `recipientKey` scopes cleanup to this
    // recipient so we don't trample tokens belonging to a different
    // recipient who shares one of the same responsibilities.
    let token = '';
    if (!dryRun) {
      try {
        // Two-tier cleanup before minting:
        //   1. Drop any prior multi-resp tokens for THIS recipient
        //      (matched by phone via `recipientKey`).
        //   2. Drop legacy single-resp tokens (no `recipientKey`) for
        //      every responsibility this recipient now owns — otherwise
        //      old per-responsibility links minted before the multi-resp
        //      rollout would stay valid forever, defeating the
        //      "blast-time rotation" guarantee.
        // Only legacy rows (recipientKey IS NULL) are touched in step 2,
        // so we never evict another recipient's multi-resp token that
        // happens to overlap on one responsibility.
        await sql`DELETE FROM obs_share_links WHERE data->>'recipientKey' = ${phone}`;
        const legacyTargets = responsibilities.map((r) => r.toLowerCase());
        if (legacyTargets.length > 0) {
          await sql`
            DELETE FROM obs_share_links
            WHERE (data->>'recipientKey') IS NULL
              AND LOWER(data->>'responsibility') = ANY(${legacyTargets}::text[])
          `;
        }
      } catch (err) {
        console.warn('[obs-summary] prior token cleanup failed (non-fatal)', err);
      }
      token = randomBytes(20).toString('hex');
      const data = {
        // Joined string kept for legacy verify/close paths; array is
        // the source of truth for the new multi-resp matcher.
        responsibility: responsibilities.length === 1 ? responsibilities[0] : responsibilities.join(', '),
        responsibilities,
        recipientKey: phone,
        label: joinedLabel,
        passwordHash: isOpenAccess ? null : hashPassword(blastPassword),
        // Unit scope: /api/obs-share `verify` and `close` filter
        // observations to this unit. Empty string keeps the legacy
        // cross-unit behaviour for blasts sent from a corporate or
        // regional scope.
        unitId: scopeUnitId,
        unitName: scopeUnitName,
        createdAt: new Date().toISOString(),
        mintedFor: 'observation-summary',
      };
      try {
        await sql`INSERT INTO obs_share_links (id, data) VALUES (${token}, ${JSON.stringify(data)}::jsonb)`;
      } catch (err) {
        perRecipient.push({ phone, name, error: 'Failed to mint share token.' });
        totals.failed += 1;
        console.error('[obs-summary] token insert failed', err);
        continue;
      }
    } else {
      token = 'dry-run-token';
    }
    const link = `${baseUrl}/obs-share/${token}`;

    const result: any = {
      phone,
      name,
      responsibilities,
      token,
      link,
      sent: false,
    };

    if (dryRun) {
      result.sent = true;
      totals.sent += 1;
      perRecipient.push(result);
      continue;
    }

    try {
      let res;
      if (mode === 'template') {
        // Pick template by recipient breadth:
        //   • 1 responsibility  → singleTemplateName, body vars
        //     [label, openCount, avgOpenAge, avgCloseTime, link]
        //   • 2+ responsibilities → multiTemplateName, body vars
        //     [recipientName, multi-line block, link]
        // Header is the same {{1}} = unit name in both templates.
        const headerParams = [unitName];
        if (items.length === 1) {
          const it = items[0];
          const params = [
            it.label,
            String(it.openCount),
            it.avgOpenAge,
            it.avgCloseTime,
            link,
          ];
          result.templateUsed = singleTemplateName;
          res = await sendWhatsAppTemplateBody(phone, singleTemplateName, params, languageCode, headerParams);
        } else {
          const params = [name, block, link];
          result.templateUsed = multiTemplateName;
          res = await sendWhatsAppTemplateBody(phone, multiTemplateName, params, languageCode, headerParams);
        }
      } else {
        const text = messageTemplate
          .replaceAll('{name}', name)
          .replaceAll('{block}', block)
          .replaceAll('{link}', link)
          .replaceAll('{password}', isOpenAccess ? '—' : blastPassword)
          .replaceAll('{unitName}', unitName)
          // Backward-compat placeholders — substitute with the FIRST
          // item's values so old custom templates don't render literal
          // braces.
          .replaceAll('{responsibility}', items[0]?.label || '')
          .replaceAll('{count}', String(items[0]?.openCount ?? 0))
          .replaceAll('{avgOpenAge}', items[0]?.avgOpenAge || 'no history')
          .replaceAll('{avgCloseTime}', items[0]?.avgCloseTime || 'no history');
        res = await sendWhatsAppText(phone, text);
      }
      if (res.ok) {
        result.sent = true;
        totals.sent += 1;
      } else {
        result.error = res.error || 'Send failed';
        result.hint = res.hint;
        totals.failed += 1;
      }
    } catch (err: any) {
      result.error = err?.message || 'Send threw';
      totals.failed += 1;
    }

    perRecipient.push(result);
  }

  // Best-effort audit log — non-fatal.
  try {
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_observation_summaries (
      id BIGSERIAL PRIMARY KEY,
      attempted INTEGER NOT NULL DEFAULT 0,
      succeeded INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`INSERT INTO whatsapp_observation_summaries (attempted, succeeded, failed, data)
              VALUES (${totals.recipientCount}, ${totals.sent}, ${totals.failed},
                ${JSON.stringify({
                  mode,
                  singleTemplateName: mode === 'template' ? singleTemplateName : null,
                  multiTemplateName: mode === 'template' ? multiTemplateName : null,
                  groupCount: totals.groupCount,
                  recipients: perRecipient.map((r) => ({
                    phone: r.phone,
                    responsibilities: r.responsibilities || [],
                    sent: !!r.sent,
                    error: r.error || null,
                  })),
                })}::jsonb)`;
  } catch (err) {
    console.error('[obs-summary] audit insert failed (non-fatal)', err);
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    totals,
    // Both shapes returned for convenience: per-recipient (the new
    // pivoted view) plus the legacy per-group skip-reasons so the UI
    // can still surface "no recipients for X" warnings.
    perRecipient,
    skippedGroups,
  });
}
