import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS training_portal_links (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const ensureCalendarTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS training_calendar (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

async function safeSelect(query: Promise<any>): Promise<any[]> {
  const rows = await query;
  return Array.isArray(rows) ? rows : [];
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const token = request.nextUrl.searchParams.get('token');
    const action = request.nextUrl.searchParams.get('action');

    if (action === 'list') {
      const unitId = request.nextUrl.searchParams.get('unitId');
      const count = await sql`SELECT COUNT(*)::int as cnt FROM training_portal_links`;
      if ((count?.[0]?.cnt ?? 0) === 0) return NextResponse.json({ links: [] });
      const rows = await safeSelect(sql`SELECT id, data FROM training_portal_links ORDER BY updated_at DESC`);
      let links = rows.map((r: any) => ({ id: r.id, ...r.data }));
      if (unitId) links = links.filter((l: any) => l.unitId === unitId);
      return NextResponse.json({ links });
    }

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const count = await sql`SELECT COUNT(*)::int as cnt FROM training_portal_links`;
    if ((count?.[0]?.cnt ?? 0) === 0) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const rows = await safeSelect(sql`SELECT id, data FROM training_portal_links WHERE id = ${token}`);
    if (rows.length === 0) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });

    const link = { id: rows[0].id, ...rows[0].data };

    const expiresAt = new Date(link.expiresAt);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: 'This link has expired', expired: true }, { status: 410 });
    }

    await ensureCalendarTable();

    const portalSessionPrefix = `portal-${token}`;
    const calCount = await sql`SELECT COUNT(*)::int as cnt FROM training_calendar`;
    let portalSessions: any[] = [];
    if ((calCount?.[0]?.cnt ?? 0) > 0) {
      const calRows = await safeSelect(sql`SELECT id, data FROM training_calendar ORDER BY updated_at DESC`);
      portalSessions = calRows
        .filter((r: any) => r.id?.startsWith(portalSessionPrefix))
        .map((r: any) => ({ id: r.id, ...r.data }));
    }

    return NextResponse.json({
      valid: true,
      link: {
        id: link.id,
        unitId: link.unitId,
        unitName: link.unitName,
        corporateName: link.corporateName,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      },
      sessions: portalSessions,
    });
  } catch (error) {
    console.error('Training portal GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { action } = body;

    if (action === 'create-link') {
      const { unitId, unitName, corporateName, expiresAt } = body;
      if (!unitId || !expiresAt) {
        return NextResponse.json({ error: 'unitId and expiresAt required' }, { status: 400 });
      }
      const token = `tp-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
      const data = {
        unitId,
        unitName: unitName || 'Unit',
        corporateName: corporateName || '',
        expiresAt,
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO training_portal_links (id, data, updated_at) VALUES (${token}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      return NextResponse.json({ success: true, token, link: { id: token, ...data } });
    }

    if (action === 'revoke-link') {
      const { token } = body;
      if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
      await sql`DELETE FROM training_portal_links WHERE id = ${token}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'save-session') {
      const { token, session } = body;
      if (!token || !session) return NextResponse.json({ error: 'Token and session required' }, { status: 400 });

      const count = await sql`SELECT COUNT(*)::int as cnt FROM training_portal_links`;
      if ((count?.[0]?.cnt ?? 0) === 0) {
        return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
      }
      const linkRows = await safeSelect(sql`SELECT id, data FROM training_portal_links WHERE id = ${token}`);
      if (linkRows.length === 0) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
      const link = { id: linkRows[0].id, ...linkRows[0].data };

      const expiresAt = new Date(link.expiresAt);
      if (expiresAt < new Date()) {
        return NextResponse.json({ error: 'Link expired' }, { status: 410 });
      }

      await ensureCalendarTable();
      const sessionId = session.id || `portal-${token}-${Date.now()}`;
      const sessionData = {
        ...session,
        id: sessionId,
        createdByEntityId: link.unitId,
        assignedUnits: [link.unitId],
        portalToken: token,
        createdViaPortal: true,
      };
      const { id: _id, ...dataWithoutId } = sessionData;
      const jsonData = JSON.stringify(dataWithoutId);
      await sql`INSERT INTO training_calendar (id, data, updated_at) VALUES (${sessionId}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      return NextResponse.json({ success: true, sessionId });
    }

    if (action === 'delete-session') {
      const { token, sessionId } = body;
      if (!token || !sessionId) return NextResponse.json({ error: 'Token and sessionId required' }, { status: 400 });
      if (!sessionId.startsWith(`portal-${token}`)) {
        return NextResponse.json({ error: 'Cannot delete sessions not created through this link' }, { status: 403 });
      }
      await ensureCalendarTable();
      await sql`DELETE FROM training_calendar WHERE id = ${sessionId}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Training portal POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
