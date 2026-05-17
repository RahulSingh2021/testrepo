import sql from '@/lib/db';

// Core WhatsApp Cloud API send logic, factored out of
// `app/api/whatsapp/send/route.ts` so server-side callers (notably the
// promo worker in `lib/whatsappPromoWorker.ts`) can invoke it directly
// instead of going through the HTTP route.
//
// Why direct invocation matters: the worker runs inside the same Next.js
// process as the route. Calling `fetch('http://127.0.0.1:5000/api/whatsapp/send')`
// from the worker reliably hangs in `next dev` (turbopack serializes
// route handlers and Node's undici keeps the socket open under that
// contention) — recipients then get stuck in the 'sending' status forever.
// Going through this function bypasses the entire HTTP round-trip.
//
// The route handler delegates to `sendWhatsAppTemplate` so the two paths
// always behave identically.

const GRAPH_VERSION = 'v21.0';

const FALLBACK_HEADER_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';

export type ObservationPayload = {
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
};

export type TrainingPromoPayload = {
  topic?: string;
  date?: string;
  time?: string;
  registrationUrl?: string;
  supportPhone?: string;
  supportEmail?: string;
  imageUrl?: string;
};

export type SendBody = {
  phone: string;
  kind: 'new' | 'followup' | 'training';
  observation?: ObservationPayload;
  training?: TrainingPromoPayload;
  languageCode?: string;
};

export type SendResult = {
  ok: boolean;
  status: number;
  messageId?: string;
  template?: string;
  to?: string;
  error?: string;
  hint?: string;
  meta?: { code?: number; subcode?: number; status: number; raw?: any };
};

const isPublicHttpsUrl = (u?: string): boolean => {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
};

const decodeDataUrl = (u: string): { buffer: Buffer; mime: string } | null => {
  const m = u.match(/^data:([^;,]+)(?:;([^,]+))?,(.*)$/);
  if (!m) return null;
  const mime = m[1] || 'image/jpeg';
  const isBase64 = (m[2] || '').toLowerCase().includes('base64');
  const data = m[3] || '';
  try {
    const buffer = isBase64
      ? Buffer.from(data, 'base64')
      : Buffer.from(decodeURIComponent(data), 'utf8');
    return { buffer, mime };
  } catch {
    return null;
  }
};

// Exported so other senders (e.g. the training-certificate WhatsApp helper
// in lib/sendWhatsApp.ts) can upload a PDF buffer to Meta and get back a
// media_id without re-implementing the multipart dance. The optional
// `filename` arg controls the WhatsApp-side display name for documents;
// for images it doesn't matter.
export const uploadMediaToMeta = async (
  phoneNumberId: string,
  accessToken: string,
  buffer: Buffer,
  mime: string,
  filename?: string,
): Promise<string | null> => {
  try {
    const ext = mime.split('/')[1] || 'bin';
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), filename || `media.${ext}`);
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form },
    );
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      console.warn('[whatsapp] media upload failed', res.status, data);
      return null;
    }
    return String(data.id);
  } catch (err) {
    console.warn('[whatsapp] media upload error', err);
    return null;
  }
};

const resolveHeaderImageParam = async (
  rawUrl: string | undefined,
  phoneNumberId: string,
  accessToken: string,
  origin: string,
): Promise<{ image: { id: string } } | { image: { link: string } }> => {
  if (rawUrl && rawUrl.startsWith('data:')) {
    const decoded = decodeDataUrl(rawUrl);
    if (decoded) {
      const mediaId = await uploadMediaToMeta(phoneNumberId, accessToken, decoded.buffer, decoded.mime);
      if (mediaId) return { image: { id: mediaId } };
    }
  }
  if (isPublicHttpsUrl(rawUrl)) return { image: { link: rawUrl! } };
  if (rawUrl && rawUrl.startsWith('/')) {
    try {
      const r = await fetch(origin + rawUrl);
      if (r.ok) {
        const mime = r.headers.get('content-type') || 'image/jpeg';
        const ab = await r.arrayBuffer();
        const mediaId = await uploadMediaToMeta(
          phoneNumberId,
          accessToken,
          Buffer.from(ab),
          mime.split(';')[0],
        );
        if (mediaId) return { image: { id: mediaId } };
      }
    } catch (err) {
      console.warn('[whatsapp] failed fetching local image', err);
    }
  }
  return { image: { link: FALLBACK_HEADER_IMAGE } };
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const formatDate = (iso?: string) => {
  if (!iso) {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const statusLabelWithEmoji = (status?: string): string => {
  const s = (status || 'OPEN').toUpperCase();
  if (s === 'RESOLVED') return '✅ Resolved';
  if (s === 'OPEN') return '🔴 Open';
  return '🔵 In Progress';
};

const statusLabelPlain = (status?: string): string => {
  const s = (status || 'OPEN').toUpperCase();
  if (s === 'RESOLVED') return 'Resolved';
  if (s === 'OPEN') return 'Open';
  if (s === 'PENDING_VERIFICATION') return 'Pending Verification';
  if (s === 'IN_PROGRESS') return 'In Progress';
  if (s === 'PENDING') return 'Pending';
  return titleCase(s.replace(/_/g, ' '));
};

const sanitizeVar = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  return s.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 1024);
};

const buildTrainingVars = (t: TrainingPromoPayload): string[] => [
  sanitizeVar(t.topic || 'Training Session'),
  sanitizeVar(t.date),
  sanitizeVar(t.time),
  sanitizeVar(t.registrationUrl),
  sanitizeVar(t.supportPhone || '+91-8239008202'),
  sanitizeVar(t.supportEmail || 'safefoodmitra@gmail.com'),
];

const buildNewObservationVars = (o: ObservationPayload): string[] => [
  sanitizeVar(o.observationText || 'Observation raised'),
  sanitizeVar(o.location || o.mainKitchen),
  sanitizeVar(o.responsibility),
  sanitizeVar(statusLabelWithEmoji(o.status)),
  sanitizeVar(o.severity ? titleCase(o.severity) : 'Minor'),
  sanitizeVar(o.sop ? o.sop.replace(/\s*>\s*/g, ' → ') : ''),
  sanitizeVar(o.reportedBy),
  sanitizeVar(formatDate(o.createdDate)),
];

const buildFollowupVars = (o: ObservationPayload): string[] => [
  sanitizeVar(statusLabelPlain(o.status)),
  sanitizeVar(o.severity ? titleCase(o.severity) : 'Minor'),
  sanitizeVar(typeof o.followUpCount === 'number' ? o.followUpCount : 1),
  sanitizeVar(o.observationText || 'Observation pending'),
  sanitizeVar(o.location || o.mainKitchen),
  sanitizeVar(o.responsibility),
  sanitizeVar(formatDate(o.createdDate)),
];

export const normalizePhone = (raw: string): string => {
  const digits = (raw || '').replace(/\D+/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

// Single source of truth for "send a templated WhatsApp message". Returns
// a structured result that both the HTTP route and the promo worker can
// translate into their preferred shape.
export async function sendWhatsAppTemplate(body: SendBody, origin: string): Promise<SendResult> {
  const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return {
      ok: false,
      status: 500,
      error: 'WhatsApp Cloud API not configured. Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN.',
    };
  }

  const phone = normalizePhone(body.phone || '');
  if (!phone || phone.length < 8) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid recipient phone number (need country code + number, digits only)',
    };
  }

  if (body.kind !== 'new' && body.kind !== 'followup' && body.kind !== 'training') {
    return { ok: false, status: 400, error: 'kind must be "new", "followup" or "training"' };
  }

  let templateName: string;
  let variables: string[];
  let headerImageSource: string | undefined;
  if (body.kind === 'training') {
    templateName = 'training_session_scheduled';
    variables = buildTrainingVars(body.training || {});
    headerImageSource = body.training?.imageUrl;
  } else if (body.kind === 'followup') {
    templateName = 'haccp_observation_followup';
    variables = buildFollowupVars(body.observation || {});
    headerImageSource = body.observation?.imageUrl;
  } else {
    templateName = 'new_observation';
    variables = buildNewObservationVars(body.observation || {});
    headerImageSource = body.observation?.imageUrl;
  }

  const headerImageParam = await resolveHeaderImageParam(
    headerImageSource,
    PHONE_NUMBER_ID,
    ACCESS_TOKEN,
    origin,
  );

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: body.languageCode || 'en' },
      components: [
        { type: 'header', parameters: [{ type: 'image', ...headerImageParam }] },
        { type: 'body', parameters: variables.map((v) => ({ type: 'text', text: v })) },
      ],
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

  let metaRes: Response;
  try {
    metaRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return {
      ok: false,
      status: 502,
      error: `Network error reaching Meta Graph API: ${err?.message || err}`,
    };
  }

  let data: any = null;
  try { data = await metaRes.json(); } catch { /* leave null */ }

  if (!metaRes.ok) {
    const errMsg = data?.error?.error_user_msg || data?.error?.message || `Meta API returned ${metaRes.status}`;
    const code = data?.error?.code;
    const subcode = data?.error?.error_subcode;
    return {
      ok: false,
      status: metaRes.status,
      error: errMsg,
      meta: { code, subcode, status: metaRes.status, raw: data?.error },
      hint:
        code === 132001 || /template/i.test(errMsg)
          ? `Template "${templateName}" is not approved yet, or its name/language doesn't match. Check WhatsApp Manager → Message Templates.`
          : code === 131030 || code === 131031
            ? 'Recipient phone number is not in your test allow-list. Add it in WhatsApp Manager → API Setup → Recipient phone numbers, or move out of sandbox mode.'
            : code === 190
              ? 'Access token is invalid or expired. Generate a new permanent System User token.'
              : undefined,
    };
  }

  const result: SendResult = {
    ok: true,
    status: 200,
    messageId: data?.messages?.[0]?.id,
    template: templateName,
    to: phone,
  };

  // Log every outbound template send so it shows up in the Inbox thread
  // alongside any inbound replies. Failures inside this helper must NEVER
  // affect the send result the caller relies on, so we swallow them.
  try {
    await logOutboundMessage({
      wamid: result.messageId || null,
      phone,
      messageType: 'template',
      body: variables.join(' | ').slice(0, 1000),
      templateName,
      status: 'sent',
      error: null,
      raw: result,
    });
  } catch (err) {
    console.warn('[whatsapp] logOutbound (template) failed', err);
  }

  return result;
}

// ── Generic body-only template send ────────────────────────────────────────
//
// Sends an arbitrary approved Meta template that has ONLY a text body
// (no header / buttons / footer parameters). Used by the multi-training
// digest blast, which needs to reach cold leads outside the 24-hour
// session window — only template messages can do that.
//
// `bodyParams` are the {{1}}, {{2}}, … substitutions in declaration order.
// Returns the same SendResult shape as `sendWhatsAppTemplate` so callers
// can treat both paths uniformly.
export async function sendWhatsAppTemplateBody(
  phone: string,
  templateName: string,
  bodyParams: string[],
  languageCode: string = 'en',
  headerParams: string[] = [],
  // Optional IMAGE header support. When `headerImageUrl` is set we
  // attach `{ type: 'image', ... }` to the header component instead of
  // text params. `origin` is needed only when the URL is a relative
  // path on this server (so we can fetch + upload it to Meta media).
  // If both `headerParams` and `headerImageUrl` are provided, the image
  // wins — Meta templates can't carry both header types simultaneously.
  headerImageUrl?: string,
  origin: string = '',
): Promise<SendResult> {
  const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { ok: false, status: 500, error: 'WhatsApp Cloud API not configured.' };
  }
  const norm = normalizePhone(phone);
  if (!norm || norm.length < 8) {
    return { ok: false, status: 400, error: 'Invalid recipient phone number' };
  }
  // Meta forbids tabs, newlines, or 5+ consecutive spaces in a single
  // template variable. (Earlier code preserved single newlines, which
  // caused the entire send to fail with error 100 "Param text cannot
  // have new-line/tab characters or more than 4 consecutive spaces".)
  // Flatten multi-line content into bullets/horizontal-rule the same
  // way as lib/sendWhatsApp.ts → flattenForWhatsApp().
  const FIELD_SEP = '  •  ';
  const CARD_SEP  = '    ✦ ━━ ✦    ';
  const sanitize = (raw: string) =>
    String(raw || '')
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map(block => block.split('\n').map(l => l.trim()).filter(Boolean).join(FIELD_SEP))
      .filter(Boolean)
      .join(CARD_SEP)
      .replace(/\t/g, ' ')
      .replace(/ {5,}/g, '    ')
      .slice(0, 1024)
      .trim();
  const safeParams = bodyParams.map(sanitize);
  const safeHeaderParams = (headerParams || []).map(sanitize);

  // Header component is OPTIONAL — only include when the caller actually
  // passed header variables. Some templates have no header (or a static
  // header with no {{N}}) and Meta will reject an empty header component.
  // Image header takes precedence when both are passed.
  const components: any[] = [];
  if (headerImageUrl && headerImageUrl.trim()) {
    const imgParam = await resolveHeaderImageParam(
      headerImageUrl.trim(),
      PHONE_NUMBER_ID,
      ACCESS_TOKEN,
      origin,
    );
    components.push({
      type: 'header',
      parameters: [{ type: 'image', ...imgParam }],
    });
  } else if (safeHeaderParams.length > 0) {
    components.push({
      type: 'header',
      parameters: safeHeaderParams.map(t => ({ type: 'text', text: t })),
    });
  }
  components.push({
    type: 'body',
    parameters: safeParams.map(t => ({ type: 'text', text: t })),
  });

  const payload = {
    messaging_product: 'whatsapp',
    to: norm,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  let metaRes: Response;
  try {
    metaRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return { ok: false, status: 502, error: `Network error: ${err?.message || err}` };
  }
  let data: any = null;
  try { data = await metaRes.json(); } catch {}
  if (!metaRes.ok) {
    const errMsg = data?.error?.error_user_msg || data?.error?.message || `Meta API returned ${metaRes.status}`;
    const code = data?.error?.code;
    return {
      ok: false,
      status: metaRes.status,
      error: errMsg,
      meta: { code, subcode: data?.error?.error_subcode, status: metaRes.status, raw: data?.error },
      hint:
        code === 132001 || /template/i.test(errMsg)
          ? `Template "${templateName}" is not approved (or its name/language doesn't match). Submit it in WhatsApp Manager → Message Templates and wait for approval.`
          : code === 132000 || code === 132012 || code === 132015 || /parameter/i.test(errMsg)
            ? 'Template variable count or formatting does not match the approved version. Re-check {{1}}/{{2}}/{{3}} in WhatsApp Manager.'
            : code === 131030 || code === 131031
              ? 'Recipient is not in the test allow-list. Move the WhatsApp number out of sandbox mode.'
              : code === 190
                ? 'Access token is invalid or expired.'
                : undefined,
    };
  }
  const result: SendResult = {
    ok: true,
    status: 200,
    messageId: data?.messages?.[0]?.id,
    template: templateName,
    to: norm,
  };
  try {
    await logOutboundMessage({
      wamid: result.messageId || null,
      phone: norm,
      messageType: 'template',
      body: safeParams.join(' | ').slice(0, 1000),
      templateName,
      status: 'sent',
      error: null,
      raw: result,
    });
  } catch {}
  return result;
}

// ── Template send WITH a document (PDF) header ──────────────────────────────
//
// Used to deliver generated PDFs (e.g. training certificates) via WhatsApp.
// Caller supplies the PDF bytes; we upload to /media to get a media_id and
// then send the template with a `header.document.id` parameter so WhatsApp
// renders the file as a downloadable attachment in-thread.
//
// Body params follow the same {{1}}/{{2}}/… ordering rules and the same
// no-newlines/no-tabs/no-5-spaces sanitisation as `sendWhatsAppTemplateBody`.
//
// Returns the same SendResult shape as the other senders so callers can
// treat all template sends uniformly.
export async function sendWhatsAppTemplateBodyWithDocument(
  phone: string,
  templateName: string,
  bodyParams: string[],
  pdfBuffer: Buffer,
  pdfFilename: string,
  languageCode: string = 'en',
): Promise<SendResult> {
  const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { ok: false, status: 500, error: 'WhatsApp Cloud API not configured.' };
  }
  const norm = normalizePhone(phone);
  if (!norm || norm.length < 8) {
    return { ok: false, status: 400, error: 'Invalid recipient phone number' };
  }
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return { ok: false, status: 400, error: 'PDF buffer is empty.' };
  }
  // WhatsApp Cloud API caps documents at 100 MB; we cap much lower so
  // /media uploads stay snappy and we don't burn bandwidth on bloated PDFs.
  if (pdfBuffer.length > 16 * 1024 * 1024) {
    return { ok: false, status: 413, error: 'PDF too large for WhatsApp document send (limit 16 MB).' };
  }

  // Same sanitisation rules as sendWhatsAppTemplateBody — Meta rejects
  // body params containing newlines, tabs, or 5+ consecutive spaces.
  const FIELD_SEP = '  •  ';
  const sanitize = (raw: string) =>
    String(raw || '')
      .replace(/\r\n?/g, '\n')
      .split(/\n+/).map(l => l.trim()).filter(Boolean).join(FIELD_SEP)
      .replace(/\t/g, ' ')
      .replace(/ {5,}/g, '    ')
      .slice(0, 1024)
      .trim();
  const safeParams = bodyParams.map(sanitize);

  const safeFilename = (pdfFilename || 'certificate.pdf').replace(/[\r\n\t]+/g, ' ').slice(0, 240);
  const mediaId = await uploadMediaToMeta(
    PHONE_NUMBER_ID,
    ACCESS_TOKEN,
    pdfBuffer,
    'application/pdf',
    safeFilename,
  );
  if (!mediaId) {
    return { ok: false, status: 502, error: 'Failed to upload PDF to WhatsApp media endpoint.' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: norm,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'header',
          parameters: [
            { type: 'document', document: { id: mediaId, filename: safeFilename } },
          ],
        },
        {
          type: 'body',
          parameters: safeParams.map(t => ({ type: 'text', text: t })),
        },
      ],
    },
  };
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  let metaRes: Response;
  try {
    metaRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return { ok: false, status: 502, error: `Network error: ${err?.message || err}` };
  }
  let data: any = null;
  try { data = await metaRes.json(); } catch {}
  if (!metaRes.ok) {
    const errMsg = data?.error?.error_user_msg || data?.error?.message || `Meta API returned ${metaRes.status}`;
    const code = data?.error?.code;
    return {
      ok: false,
      status: metaRes.status,
      error: errMsg,
      meta: { code, subcode: data?.error?.error_subcode, status: metaRes.status, raw: data?.error },
      hint:
        code === 132001 || /template/i.test(errMsg)
          ? `Template "${templateName}" is not approved (or its name/language doesn't match). Submit it in WhatsApp Manager → Message Templates with a DOCUMENT header and wait for approval.`
          : code === 132000 || code === 132012 || code === 132015 || /parameter/i.test(errMsg)
            ? 'Template variable count or formatting does not match the approved version. Re-check {{1}}/{{2}}/{{3}} and the document header in WhatsApp Manager.'
            : code === 131030 || code === 131031
              ? 'Recipient is not in the test allow-list. Move the WhatsApp number out of sandbox mode.'
              : code === 190
                ? 'Access token is invalid or expired.'
                : undefined,
    };
  }
  const result: SendResult = {
    ok: true,
    status: 200,
    messageId: data?.messages?.[0]?.id,
    template: templateName,
    to: norm,
  };
  try {
    await logOutboundMessage({
      wamid: result.messageId || null,
      phone: norm,
      // Store as `document` (not `template`) so the inbox UI's media
      // renderer treats it like an attachment instead of plain text.
      // The body becomes a plain caption (template params joined) — no
      // bracket prefix needed because the document tile renders above.
      messageType: 'document',
      body: safeParams.join(' | ').slice(0, 1000),
      templateName,
      status: 'sent',
      error: null,
      // Embed the Meta media id + filename + mime so the media proxy
      // can fetch the bytes back. The proxy looks under `raw.document`
      // (or `raw[message_type]`) for `id` / `filename` / `mime_type`.
      raw: {
        document: { id: mediaId, filename: safeFilename, mime_type: 'application/pdf' },
        template: { name: templateName, language: languageCode, params: safeParams },
        send: result,
      },
    });
  } catch {}
  return result;
}

// ── Free-form text send (24-hour customer service window only) ─────────────
//
// Meta only allows sending non-template `type:'text'` messages within 24
// hours of the customer's last inbound message. Outside that window the
// API returns error code 131047 and we surface its message verbatim so
// the admin sees "send a template instead".
export async function sendWhatsAppText(
  phone: string,
  text: string,
): Promise<SendResult> {
  const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return {
      ok: false,
      status: 500,
      error: 'WhatsApp Cloud API not configured.',
    };
  }
  const norm = normalizePhone(phone);
  if (!norm || norm.length < 8) {
    return { ok: false, status: 400, error: 'Invalid recipient phone number' };
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: norm,
    type: 'text',
    text: { preview_url: true, body: text.slice(0, 4096) },
  };
  let metaRes: Response;
  try {
    metaRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return { ok: false, status: 502, error: `Network error: ${err?.message || err}` };
  }
  let data: any = null;
  try { data = await metaRes.json(); } catch {}
  if (!metaRes.ok) {
    const errMsg = data?.error?.error_user_msg || data?.error?.message || `Meta API returned ${metaRes.status}`;
    const code = data?.error?.code;
    return {
      ok: false,
      status: metaRes.status,
      error: errMsg,
      meta: { code, subcode: data?.error?.error_subcode, status: metaRes.status, raw: data?.error },
      hint:
        code === 131047 || /re-?engagement|24[- ]hour|outside.*window/i.test(errMsg)
          ? 'Free-form replies only work within 24 hours of the customer\'s last message. Send an approved template instead.'
          : code === 190
            ? 'Access token is invalid or expired. Generate a new permanent System User token.'
            : undefined,
    };
  }
  return {
    ok: true,
    status: 200,
    messageId: data?.messages?.[0]?.id,
    to: norm,
  };
}

// ── Outbound message persistence ───────────────────────────────────────────
//
// Used by both `sendWhatsAppTemplate` (template sends) and the inbox API
// (free-form text replies) to record outgoing traffic in the same table
// the webhook writes inbound messages and status receipts to. That single
// table is what the Inbox UI renders as a chronological thread.
export async function logOutboundMessage(params: {
  wamid: string | null;
  phone: string;
  messageType: string;
  body: string;
  templateName: string | null;
  status: string;
  error: string | null;
  raw: any;
}): Promise<void> {
  const { wamid, phone, messageType, body, templateName, status, error, raw } = params;
  // Best-effort table create — only matters on a fresh DB before
  // sync-to-db has run; the cost is negligible.
  try {
    await sql`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id BIGSERIAL PRIMARY KEY,
      wamid TEXT UNIQUE,
      direction TEXT NOT NULL,
      phone TEXT NOT NULL,
      contact_name TEXT,
      message_type TEXT,
      body TEXT,
      template_name TEXT,
      status TEXT,
      error TEXT,
      raw JSONB,
      read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  } catch {}
  // ON CONFLICT — a status-receipt placeholder may already exist for
  // this wamid (the webhook inserts a stub row keyed by wamid the moment
  // a delivered/read receipt arrives, which can race ahead of our
  // outbound INSERT here). When that happens the stub has
  // message_type='unknown' and body=NULL — DO NOTHING would leave the
  // inbox showing "[unknown]" forever. We instead overwrite those
  // placeholder fields with the real outbound metadata while preserving
  // whatever status the receipt already established.
  await sql`INSERT INTO whatsapp_messages
              (wamid, direction, phone, message_type, body, template_name, status, error, raw, read_by_admin)
            VALUES
              (${wamid}, 'out', ${phone}, ${messageType}, ${body}, ${templateName},
               ${status}, ${error}, ${JSON.stringify(raw || {})}::jsonb, TRUE)
            ON CONFLICT (wamid) DO UPDATE SET
              message_type  = COALESCE(NULLIF(whatsapp_messages.message_type, 'unknown'), EXCLUDED.message_type),
              body          = COALESCE(whatsapp_messages.body, EXCLUDED.body),
              template_name = COALESCE(whatsapp_messages.template_name, EXCLUDED.template_name),
              raw           = CASE
                                WHEN whatsapp_messages.message_type = 'unknown'
                                  THEN EXCLUDED.raw
                                ELSE whatsapp_messages.raw
                              END`;
}
