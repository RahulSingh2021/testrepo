import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import crypto from 'crypto';
import { getUnsubscribedSet } from '@/lib/marketingUnsubscribe';
import { requireAdminSession } from '@/lib/adminAuth';

// ── Marketing Participants Database ─────────────────────────────────────────
// Single de-duplicated contact list for marketing. Two sources are merged on
// every GET:
//   1. training_registrations  — every public LMS training-register submission
//      (the system of record; participants who already registered for a
//      session are automatically marketable).
//   2. marketing_participants  — externally-imported contacts (CSV upload,
//      paste-from-spreadsheet, or manual entry on the LMS Participants
//      Database tab).
// Dedup key is `lower(email) || digits(mobile)` so the same person can't
// appear twice no matter which source they came from. Training-registration
// rows win on tie (richer data; auto-tracks new registrations forever).

const ensureTables = async () => {
  await sql`CREATE TABLE IF NOT EXISTS marketing_participants (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mkt_participants_created ON marketing_participants(created_at DESC)`;
};

interface ParticipantRow {
  id: string;
  source: 'training' | 'imported';
  addedDate: string;
  title: string;          // sessionTitle / batch / list label
  fullName: string;
  email: string;
  countryCode: string;    // e.g. "+91"
  mobile: string;         // local digits only (no country code)
  profession: string;
  organisation: string;
}

const digitsOnly = (s: unknown): string => String(s ?? '').replace(/\D/g, '');
const lc = (s: unknown): string => String(s ?? '').trim().toLowerCase();

// Split a raw whatsapp/mobile string into (countryCode, localNumber).
// Best-effort: looks for a leading "+NN" or "00NN"; falls back to "" / digits.
const splitPhone = (raw: unknown): { code: string; local: string } => {
  const s = String(raw ?? '').trim();
  if (!s) return { code: '', local: '' };
  const plus = s.match(/^\+(\d{1,4})[\s-]?(.*)$/);
  if (plus) return { code: `+${plus[1]}`, local: digitsOnly(plus[2]) };
  const z00 = s.match(/^00(\d{1,4})[\s-]?(.*)$/);
  if (z00) return { code: `+${z00[1]}`, local: digitsOnly(z00[2]) };
  // No prefix — return everything as local digits.
  return { code: '', local: digitsOnly(s) };
};

const dedupKey = (email: string, mobile: string): string => {
  const e = lc(email);
  const d = digitsOnly(mobile);
  if (e && d) return `${e}|${d}`;
  if (e) return `e:${e}`;
  if (d) return `m:${d}`;
  return '';
};

// Pull every training-registrations row and flatten the per-participant
// `participants[]` shape (newer batch submissions) AND the legacy single-
// payload shape into one ParticipantRow per actual person.
const loadTrainingParticipants = async (): Promise<ParticipantRow[]> => {
  let rows: any[] = [];
  try {
    rows = (await sql`SELECT id, session_id, data, created_at FROM training_registrations ORDER BY created_at DESC`) as any[];
  } catch (e) {
    console.error('marketing-participants: training_registrations read failed', e);
    return [];
  }
  const out: ParticipantRow[] = [];
  for (const r of rows) {
    const d = r.data || {};
    const sessionTitle: string = String(d.sessionTitle || '');
    const addedDate: string = r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString();
    const list: any[] = Array.isArray(d.participants) && d.participants.length > 0
      ? d.participants
      : [d];
    list.forEach((p: any, idx: number) => {
      const phone = splitPhone(p.whatsapp || p.mobile || p.phone || '');
      out.push({
        id: `${r.id}:${idx}`,
        source: 'training',
        addedDate,
        title: sessionTitle,
        fullName: String(p.name || '').trim(),
        email: String(p.email || '').trim(),
        countryCode: phone.code,
        mobile: phone.local,
        profession: String(p.profession || '').trim(),
        organisation: String(p.instituteName || p.organisation || p.organization || p.designation || '').trim(),
      });
    });
  }
  return out;
};

const loadImportedParticipants = async (): Promise<ParticipantRow[]> => {
  let rows: any[] = [];
  try {
    rows = (await sql`SELECT id, data, created_at FROM marketing_participants ORDER BY created_at DESC`) as any[];
  } catch (e) {
    console.error('marketing-participants: imported read failed', e);
    return [];
  }
  return rows.map((r: any) => {
    const d = r.data || {};
    const phone = splitPhone(d.mobile ? `${d.countryCode || ''}${d.mobile}` : (d.whatsapp || ''));
    return {
      id: r.id,
      source: 'imported' as const,
      addedDate: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      title: String(d.title || 'Imported'),
      fullName: String(d.fullName || d.name || '').trim(),
      email: String(d.email || '').trim(),
      countryCode: String(d.countryCode || phone.code || ''),
      mobile: String(d.mobile || phone.local || ''),
      profession: String(d.profession || '').trim(),
      organisation: String(d.organisation || d.organization || '').trim(),
    };
  });
};

// Merge + dedup. Training rows are inserted first (newest first), so they
// already win on tie. Imported rows only fill gaps where the training feed
// has nothing matching.
const mergeDedup = (training: ParticipantRow[], imported: ParticipantRow[]): ParticipantRow[] => {
  const seen = new Map<string, ParticipantRow>();
  const orphans: ParticipantRow[] = [];
  for (const p of training) {
    const key = dedupKey(p.email, p.mobile);
    if (!key) { orphans.push(p); continue; }
    if (!seen.has(key)) seen.set(key, p);
  }
  for (const p of imported) {
    const key = dedupKey(p.email, p.mobile);
    if (!key) { orphans.push(p); continue; }
    if (!seen.has(key)) seen.set(key, p);
  }
  // Orphan rows (no email AND no mobile) are kept but still de-duped by
  // name+title so a re-imported blank row doesn't multiply.
  const orphanSeen = new Set<string>();
  for (const p of orphans) {
    const k = `o:${lc(p.fullName)}|${lc(p.title)}`;
    if (orphanSeen.has(k)) continue;
    orphanSeen.add(k);
    seen.set(k, p);
  }
  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime(),
  );
};

// All handlers are admin-guarded — this dataset is the marketing PII
// source (names, emails, phone numbers, opt-out state) and the bulk-email
// composer's recipient pool, so it must never be reachable anonymously.
export async function GET(request: NextRequest) {
  const authError = await requireAdminSession(request);
  if (authError) return authError;
  try {
    await ensureTables();
    const [training, imported, optedOut] = await Promise.all([
      loadTrainingParticipants(),
      loadImportedParticipants(),
      getUnsubscribedSet(),
    ]);
    const items = mergeDedup(training, imported).map(p => ({
      ...p,
      // Surface the unsubscribe state so the bulk-email composer can hide
      // opted-out rows from the recipient picker (the send loop drops them
      // server-side too — defence in depth).
      unsubscribed: optedOut.has(String(p.email || '').trim().toLowerCase()),
    }));
    return NextResponse.json({
      items,
      counts: {
        total: items.length,
        fromTraining: training.length,
        imported: imported.length,
        unsubscribed: items.filter(p => p.unsubscribed).length,
      },
    });
  } catch (error) {
    console.error('marketing-participants GET error:', error);
    return NextResponse.json({ items: [], counts: { total: 0, fromTraining: 0, imported: 0 } }, { status: 200 });
  }
}

interface IncomingParticipant {
  title?: string;
  fullName?: string;
  name?: string;
  email?: string;
  countryCode?: string;
  mobile?: string;
  whatsapp?: string;
  profession?: string;
  organisation?: string;
  organization?: string;
}

// POST accepts { items: IncomingParticipant[] } and returns
// { inserted, skipped, total } so the UI can show "12 added, 3 already
// existed". Skip rule: matches dedupKey of any existing row from EITHER
// source. Empty rows (no email AND no mobile AND no name) are dropped.
export async function POST(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const arr: IncomingParticipant[] = Array.isArray(body?.items) ? body.items : [];
    if (arr.length === 0) {
      return NextResponse.json({ error: 'No items provided.' }, { status: 400 });
    }
    if (arr.length > 50000) {
      return NextResponse.json({ error: 'Maximum 50,000 contacts per upload.' }, { status: 400 });
    }
    const [training, imported] = await Promise.all([
      loadTrainingParticipants(),
      loadImportedParticipants(),
    ]);
    // Two indexes — by email and by mobile-digits — so a CSV row that only
    // carries one of the two still matches an existing record that has the
    // other. Training-source hits short-circuit (we can't edit registration
    // rows here); imported-source hits become MERGE targets so missing
    // fields can be filled in by the new upload.
    const trainingByEmail = new Map<string, ParticipantRow>();
    const trainingByMobile = new Map<string, ParticipantRow>();
    const importedByEmail = new Map<string, ParticipantRow>();
    const importedByMobile = new Map<string, ParticipantRow>();
    for (const p of training) {
      const e = lc(p.email); if (e) trainingByEmail.set(e, p);
      const d = digitsOnly(p.mobile); if (d) trainingByMobile.set(d, p);
    }
    for (const p of imported) {
      const e = lc(p.email); if (e && !importedByEmail.has(e)) importedByEmail.set(e, p);
      const d = digitsOnly(p.mobile); if (d && !importedByMobile.has(d)) importedByMobile.set(d, p);
    }
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    // First pass: classify every row in memory (no DB calls). We collect
    // the to-insert and to-update lists, then flush them in a couple of
    // bulk SQL statements via unnest(). This turns 3,000+ round-trips
    // into ~5 queries total — what was previously a multi-minute import
    // now finishes in a couple of seconds.
    const toInsert: { id: string; data: Record<string, string> }[] = [];
    const toUpdate: { id: string; data: Record<string, string> }[] = [];
    for (const raw of arr) {
      const fullName = String(raw.fullName ?? raw.name ?? '').trim();
      const email = String(raw.email ?? '').trim();
      const phone = raw.mobile
        ? splitPhone(`${raw.countryCode || ''}${raw.mobile}`)
        : splitPhone(raw.whatsapp || '');
      const countryCode = String(raw.countryCode || phone.code || '');
      const mobile = String(raw.mobile || phone.local || '');
      if (!fullName && !email && !mobile) { skipped++; continue; }

      const eKey = lc(email);
      const mKey = digitsOnly(mobile);
      if ((eKey && trainingByEmail.has(eKey)) || (mKey && trainingByMobile.has(mKey))) {
        skipped++;
        continue;
      }
      const existing = (eKey && importedByEmail.get(eKey)) || (mKey && importedByMobile.get(mKey));
      if (existing) {
        const merged: Record<string, string> = {
          title:        existing.title        || (String(raw.title || '').trim() || 'Imported'),
          fullName:     existing.fullName     || fullName,
          email:        existing.email        || email,
          countryCode:  existing.countryCode  || countryCode,
          mobile:       existing.mobile       || mobile,
          profession:   existing.profession   || String(raw.profession || '').trim(),
          organisation: existing.organisation || String(raw.organisation || raw.organization || '').trim(),
        };
        const changed =
          (!existing.fullName     && !!merged.fullName) ||
          (!existing.email        && !!merged.email) ||
          (!existing.countryCode  && !!merged.countryCode) ||
          (!existing.mobile       && !!merged.mobile) ||
          (!existing.profession   && !!merged.profession) ||
          (!existing.organisation && !!merged.organisation);
        if (!changed) { skipped++; continue; }
        toUpdate.push({ id: existing.id, data: merged });
        // Refresh indexes so later rows in the same batch see the new ids.
        const newE = lc(merged.email); if (newE) importedByEmail.set(newE, { ...existing, ...merged } as any);
        const newM = digitsOnly(merged.mobile); if (newM) importedByMobile.set(newM, { ...existing, ...merged } as any);
        continue;
      }

      const id = crypto.randomUUID();
      const data: Record<string, string> = {
        title: String(raw.title || 'Imported').trim() || 'Imported',
        fullName,
        email,
        countryCode,
        mobile,
        profession: String(raw.profession || '').trim(),
        organisation: String(raw.organisation || raw.organization || '').trim(),
      };
      toInsert.push({ id, data });
      const newRow: ParticipantRow = { id, source: 'imported', addedDate: new Date().toISOString(), ...data } as ParticipantRow;
      if (eKey) importedByEmail.set(eKey, newRow);
      if (mKey) importedByMobile.set(mKey, newRow);
    }

    // ── Bulk write: chunked unnest() inserts and updates ────────────────
    const CHUNK = 1000;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const slice = toInsert.slice(i, i + CHUNK);
      const ids = slice.map(s => s.id);
      const datas = slice.map(s => JSON.stringify(s.data));
      try {
        await sql`
          INSERT INTO marketing_participants (id, data)
          SELECT * FROM unnest(${ids}::text[], ${datas}::jsonb[]) AS t(id, data)
          ON CONFLICT (id) DO NOTHING
        `;
        inserted += slice.length;
      } catch (e) {
        console.error('marketing-participants bulk insert failed:', e);
        skipped += slice.length;
      }
    }
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const slice = toUpdate.slice(i, i + CHUNK);
      const ids = slice.map(s => s.id);
      const datas = slice.map(s => JSON.stringify(s.data));
      try {
        await sql`
          UPDATE marketing_participants AS m
             SET data = m.data || u.data
            FROM unnest(${ids}::text[], ${datas}::jsonb[]) AS u(id, data)
           WHERE m.id = u.id
        `;
        updated += slice.length;
      } catch (e) {
        console.error('marketing-participants bulk update failed:', e);
        skipped += slice.length;
      }
    }
    return NextResponse.json({ inserted, updated, skipped, total: arr.length });
  } catch (error) {
    console.error('marketing-participants POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — accepts { id } to remove a single imported row. Training
// rows are read-only here (their source of truth is /api/training-register
// — deletes there propagate automatically on next GET).
export async function DELETE(req: NextRequest) {
  const authError = await requireAdminSession(req);
  if (authError) return authError;
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await sql`DELETE FROM marketing_participants WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('marketing-participants DELETE error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
