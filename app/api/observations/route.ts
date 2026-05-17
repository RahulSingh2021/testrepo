import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// THUMB_MAX bumped from 150 KB → 400 KB so closure images saved via
// the public share link survive the slim-list size guard. Client-side
// `compressImageForSave` targets ~100 KB but can overshoot at the
// canvas.toDataURL quality floor (0.1) on very large source photos;
// 400 KB gives a comfortable headroom while still capping the list
// payload (≈80 MB worst case at 200 fully-resolved observations,
// which is acceptable for an internal admin portal).
const THUMB_MAX = 400000;
const EVIDENCE_MAX = 2000;

function isLargeBase64(val: any, limit: number): boolean {
  return typeof val === 'string' && val.length > limit && val.startsWith('data:');
}

function stripEvidenceArray(arr: any[]): any[] {
  return arr.map((item: any) => {
    if (!item) return item;
    if (typeof item === 'string' && isLargeBase64(item, EVIDENCE_MAX)) return '';
    if (typeof item === 'object') {
      const copy = { ...item };
      if (isLargeBase64(copy.url, EVIDENCE_MAX)) copy.url = '';
      if (isLargeBase64(copy.image, EVIDENCE_MAX)) copy.image = '';
      if (isLargeBase64(copy.data, EVIDENCE_MAX)) copy.data = '';
      if (isLargeBase64(copy.src, EVIDENCE_MAX)) copy.src = '';
      return copy;
    }
    return item;
  });
}

function stripHeavyFields(obs: any): any {
  const result = { ...obs };
  if (isLargeBase64(result.thumbnail, THUMB_MAX)) result.thumbnail = '';
  if (isLargeBase64(result.afterImage, THUMB_MAX)) result.afterImage = '';
  const otherImgKeys = ['beforeImage', 'image', 'signature'];
  for (const key of otherImgKeys) {
    if (isLargeBase64(result[key], THUMB_MAX)) result[key] = '';
  }
  if (result.closureEvidence) {
    if (typeof result.closureEvidence === 'string' && isLargeBase64(result.closureEvidence, EVIDENCE_MAX)) {
      result.closureEvidence = '';
    } else if (Array.isArray(result.closureEvidence)) {
      result.closureEvidence = stripEvidenceArray(result.closureEvidence);
    }
  }
  if (Array.isArray(result.allEvidence)) {
    result.allEvidence = stripEvidenceArray(result.allEvidence);
  }
  if (Array.isArray(result.evidence)) {
    result.evidence = stripEvidenceArray(result.evidence);
  }
  if (Array.isArray(result.tracking)) {
    result.tracking = result.tracking.map((t: any) => {
      if (!t) return t;
      const tc = { ...t };
      if (isLargeBase64(tc.image, EVIDENCE_MAX)) tc.image = '';
      if (Array.isArray(tc.evidence)) tc.evidence = stripEvidenceArray(tc.evidence);
      if (Array.isArray(tc.allEvidence)) tc.allEvidence = stripEvidenceArray(tc.allEvidence);
      return tc;
    });
  }
  if (result.breakdownDetails) {
    const bd = { ...result.breakdownDetails };
    if (Array.isArray(bd.updates)) {
      bd.updates = bd.updates.map((u: any) => {
        if (!u) return u;
        const uc = { ...u };
        if (isLargeBase64(uc.image, EVIDENCE_MAX)) uc.image = '';
        return uc;
      });
    }
    result.breakdownDetails = bd;
  }
  return result;
}

function extractSlimObs(r: any): any {
  const d = r.data || {};
  return {
    id: r.id,
    unitId: d.unitId || '',
    unitName: d.unitName || '',
    regionalId: d.regionalId || '',
    regionalName: d.regionalName || '',
    checklistName: d.checklistName || '',
    questionText: d.questionText || '',
    observationText: d.observationText || '',
    title: d.title || '',
    status: d.status || '',
    severity: d.severity || '',
    level: d.level || '',
    area: d.area || '',
    departmentName: d.departmentName || '',
    departmentId: d.departmentId || '',
    mainKitchen: d.mainKitchen || '',
    createdDate: d.createdDate || '',
    closureDate: d.closureDate || '',
    inProgressDate: d.inProgressDate || '',
    reportedBy: d.reportedBy || '',
    reportedByUserId: d.reportedByUserId || '',
    sop: d.sop || '',
    sectionTitle: d.sectionTitle || '',
    isStarred: d.isStarred || false,
    isRepeat: d.isRepeat || false,
    repeatOriginalDate: d.repeatOriginalDate || '',
    repeatTrail: d.repeatTrail || [],
    followUpStatus: d.followUpStatus || '',
    followUpCount: d.followUpCount || 0,
    followUpDate: d.followUpDate || '',
    managementTag: d.managementTag || '',
    resourceRequired: d.resourceRequired || false,
    isAuditSourced: d.isAuditSourced || false,
    auditTaskId: d.auditTaskId || '',
    auditObsQuestionId: d.auditObsQuestionId || '',
    parentObservationId: d.parentObservationId || '',
    people: d.people || [],
    assets: d.assets || [],
    categories: d.categories || [],
    tracking: (d.tracking || []).map((t: any) => ({ id: t.id, label: t.label || '', user: t.user || '', timestamp: t.timestamp || '', comments: t.comments || '' })),
    breakdownDetails: d.breakdownDetails ? {
      isActive: d.breakdownDetails.isActive || false,
      status: d.breakdownDetails.status || 'active',
      equipment: d.breakdownDetails.equipment || '',
      rootCause: d.breakdownDetails.rootCause || '',
      totalCost: d.breakdownDetails.totalCost ?? 0,
      history: Array.isArray(d.breakdownDetails.history) ? d.breakdownDetails.history : [],
    } : undefined,
    thumbnail: (typeof d.thumbnail === 'string' && d.thumbnail.length < THUMB_MAX) ? d.thumbnail : '',
    // Closure evidence — the primary "after" image rendered on the
    // Observation Registry cards (desktop + mobile). Without this the
    // closure image saved via the share link / closure modal silently
    // disappears on the next list refresh because the slim payload
    // dropped `afterImage` even though the row in Postgres has it.
    // Same THUMB_MAX guard used for `thumbnail` so we don't bloat the
    // list payload with oversized base64 — those rare cases can still
    // be re-fetched per-row via `?withImages=<id>`.
    afterImage: (typeof d.afterImage === 'string' && d.afterImage.length < THUMB_MAX) ? d.afterImage : '',
    closureEvidence: Array.isArray(d.closureEvidence) ? d.closureEvidence.slice(0, 3).map((e: any) => {
      if (typeof e === 'string') return e.length < EVIDENCE_MAX ? e : '';
      if (typeof e === 'object' && e) return { url: (e.url && e.url.length < EVIDENCE_MAX) ? e.url : '' };
      return e;
    }) : [],
    allEvidence: Array.isArray(d.allEvidence) ? d.allEvidence.slice(0, 3).map((e: any) => {
      if (typeof e === 'string') return e.length < EVIDENCE_MAX ? e : '';
      if (typeof e === 'object' && e) return { url: (e.url && e.url.length < EVIDENCE_MAX) ? e.url : '' };
      return e;
    }) : [],
    maxMarks: d.maxMarks ?? 0,
    potentialMarkLoss: d.potentialMarkLoss ?? 0,
    closureComments: d.closureComments || '',
    selectedAnswer: d.selectedAnswer || '',
    selectedResponseIndex: d.selectedResponseIndex ?? null,
    duration: d.duration || '',
    lastUpdate: d.lastUpdate || '',
    hierarchy: d.hierarchy || '',
  };
}

export async function GET(request: NextRequest) {
  const slim = request.nextUrl.searchParams.get('slim') === '1';
  const unitId = request.nextUrl.searchParams.get('unitId') || '';
  const withImages = request.nextUrl.searchParams.get('withImages') || '';

  // Fetch a single observation with full image data (allEvidence not stripped)
  if (withImages) {
    try {
      const rows = await sql`SELECT id, data FROM observations WHERE id = ${withImages} LIMIT 1`;
      if (!rows || rows.length === 0) return NextResponse.json(null);
      const r = rows[0];
      const d = { id: r.id, ...r.data };
      return NextResponse.json({
        id: d.id,
        thumbnail: d.thumbnail || '',
        allEvidence: Array.isArray(d.allEvidence) ? d.allEvidence : [],
      });
    } catch (err) {
      console.error('withImages fetch failed:', err);
      return NextResponse.json(null);
    }
  }

  try {
    if (slim) {
      try {
        let rows;
        if (unitId) {
          // Keep `afterImage` and `closureEvidence` in the JSONB so
          // extractSlimObs can read them — they're already size-bounded
          // by THUMB_MAX / EVIDENCE_MAX inside extractSlimObs. Stripping
          // them at the SQL layer was the root cause of closure images
          // saved via the public share link not appearing on the
          // Observation Registry cards (only comments / status came
          // through). `allEvidence` and `evidenceImages` stay stripped
          // because they're unbounded image arrays.
          rows = await sql`SELECT id, data - 'allEvidence' - 'evidenceImages' as data FROM observations WHERE data->>'unitId' = ${unitId} ORDER BY created_at DESC`;
        } else {
          rows = await sql`SELECT id, data - 'allEvidence' - 'thumbnail' - 'evidenceImages' as data FROM observations ORDER BY created_at DESC`;
        }
        const observations = (rows || []).map((r: any) => extractSlimObs(r));
        return NextResponse.json(observations, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
      } catch (bulkErr) {
        console.error('Failed to fetch slim observations (bulk), trying row-by-row:', bulkErr);
        const idRows = unitId
          ? await sql`SELECT id FROM observations WHERE data->>'unitId' = ${unitId} ORDER BY created_at DESC`
          : await sql`SELECT id FROM observations ORDER BY created_at DESC`;
        if (!idRows || idRows.length === 0) return NextResponse.json([]);
        const observations: any[] = [];
        const BATCH = 20;
        for (let i = 0; i < idRows.length; i += BATCH) {
          const batch = idRows.slice(i, i + BATCH);
          const results = await Promise.all(batch.map(async ({ id }: { id: string }) => {
            try {
              // Same rationale as the bulk query above — keep
              // afterImage/closureEvidence so extractSlimObs can
              // surface the closure thumbnail.
              const rows = await sql`SELECT id, data - 'allEvidence' - 'evidenceImages' as data FROM observations WHERE id = ${id}`;
              if (rows && rows.length > 0) return extractSlimObs(rows[0]);
            } catch {}
            return null;
          }));
          results.forEach(r => { if (r) observations.push(r); });
        }
        console.log(`[observations] Slim row-by-row fetch completed: ${observations.length} observations`);
        return NextResponse.json(observations, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
      }
    }

    const rows = unitId
      ? await sql`SELECT id, data FROM observations WHERE data->>'unitId' = ${unitId} ORDER BY created_at DESC`
      : await sql`SELECT id, data FROM observations ORDER BY created_at DESC`;
    const observations = (rows || []).map((r: any) => stripHeavyFields({ id: r.id, ...r.data }));
    return NextResponse.json(observations, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Failed to fetch observations (bulk), trying row-by-row:', error);
    try {
      const idRows = unitId
        ? await sql`SELECT id FROM observations WHERE data->>'unitId' = ${unitId} ORDER BY created_at DESC`
        : await sql`SELECT id FROM observations ORDER BY created_at DESC`;
      if (!idRows || idRows.length === 0) return NextResponse.json([]);
      const observations: any[] = [];
      const BATCH = 15;
      for (let i = 0; i < idRows.length; i += BATCH) {
        const batch = idRows.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async ({ id }: { id: string }) => {
          try {
            const rows = await sql`SELECT id, data - 'evidenceImages' as data FROM observations WHERE id = ${id}`;
            if (rows && rows.length > 0) {
              return stripHeavyFields({ id: rows[0].id, ...rows[0].data });
            }
          } catch {}
          return null;
        }));
        results.forEach(r => { if (r) observations.push(r); });
      }
      console.log(`[observations] Row-by-row fetch completed: ${observations.length} observations`);
      return NextResponse.json(observations, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    } catch (fallbackError) {
      console.error('Row-by-row observation fetch also failed:', fallbackError);
      return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }
  }
}

function isEmptyEvidence(v: any): boolean {
  if (v === '' || v === null || v === undefined) return true;
  if (typeof v === 'object' && v !== null) {
    const vals = Object.values(v);
    return vals.length === 0 || vals.every((val: any) => val === '' || val === null || val === undefined);
  }
  return false;
}

function stripEmptyHeavyFields(data: any): any {
  const copy = { ...data };
  const imgFields = ['thumbnail', 'afterImage', 'beforeImage', 'image', 'signature'];
  const arrFields = ['allEvidence', 'evidenceImages', 'closureEvidence', 'evidence'];
  for (const f of imgFields) {
    if (f in copy && (copy[f] === '' || copy[f] === null || copy[f] === undefined)) delete copy[f];
  }
  for (const f of arrFields) {
    if (f in copy && Array.isArray(copy[f]) && (copy[f].length === 0 || copy[f].every(isEmptyEvidence))) delete copy[f];
  }
  return copy;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < body.length; i += BATCH_SIZE) {
        const batch = body.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (obs: any) => {
          const { id, ...rawData } = obs;
          const data = stripEmptyHeavyFields(rawData);
          const jsonData = JSON.stringify(data);
          await sql`INSERT INTO observations (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW())
                    ON CONFLICT (id) DO UPDATE SET data = observations.data || ${jsonData}::jsonb, updated_at = NOW()`;
        }));
      }
      return NextResponse.json({ success: true, count: body.length });
    }

    const { id, ...rawData } = body;
    const data = stripEmptyHeavyFields(rawData);
    const jsonData = JSON.stringify(data);
    await sql`INSERT INTO observations (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW())
              ON CONFLICT (id) DO UPDATE SET data = observations.data || ${jsonData}::jsonb, updated_at = NOW()`;
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to save observation:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (action === 'strip-images') {
      await sql`UPDATE observations SET data = data || '{"thumbnail":"","afterImage":"","beforeImage":"","image":"","signature":"","allEvidence":[],"evidenceImages":[],"closureEvidence":[],"evidence":[]}'::jsonb, updated_at = NOW()`;
      return NextResponse.json({ success: true, message: 'All images stripped from observations' });
    }
    return NextResponse.json({ success: true, cleaned: 0, total: 0, message: 'No action specified' });
  } catch (error) {
    console.error('PATCH observations error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let id = url.searchParams.get('id');
    if (!id) {
      try {
        const body = await request.json();
        id = body?.id || null;
      } catch {}
    }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await sql`DELETE FROM observations WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete observation:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
