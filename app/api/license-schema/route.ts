import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

function filterCategoriesByEntity(categories: any[], userCorporateId: string | null, ancestorCorporateIds: Set<string> = new Set()): any[] {
  return categories.map(category => ({
    ...category,
    subs: category.subs ? filterSubsByEntity(category.subs, userCorporateId, ancestorCorporateIds) : []
  })).filter(cat => {
    if (!cat.subs || cat.subs.length === 0) return false;
    const createdBy = cat.createdByEntityId || null;
    if (createdBy === null) return true;
    if (createdBy === userCorporateId) return true;
    if (ancestorCorporateIds.has(createdBy)) return true;
    return false;
  });
}

function filterSubsByEntity(subs: any[], userCorporateId: string | null, ancestorCorporateIds: Set<string> = new Set()): any[] {
  return subs.map(sub => ({
    ...sub,
    subSubs: sub.subSubs ? filterSubSubsByEntity(sub.subSubs, userCorporateId, ancestorCorporateIds) : []
  })).filter(sub => {
    const createdBy = sub.createdByEntityId || null;
    if (createdBy === null) return true;
    if (createdBy === userCorporateId) return true;
    if (ancestorCorporateIds.has(createdBy)) return true;
    return false;
  });
}

function filterSubSubsByEntity(subSubs: any[], userCorporateId: string | null, ancestorCorporateIds: Set<string> = new Set()): any[] {
  return subSubs.filter(subSub => {
    const createdBy = subSub.createdByEntityId || null;
    if (createdBy === null) return true;
    if (createdBy === userCorporateId) return true;
    if (ancestorCorporateIds.has(createdBy)) return true;
    return false;
  });
}

export async function GET(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS license_schema (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    
    const searchParams = request.nextUrl.searchParams;
    const userCorporateId = searchParams.get('corporateId');
    const ancestorIds = searchParams.get('ancestorIds');
    const ancestorCorporateIds = ancestorIds ? new Set(ancestorIds.split(',')) : new Set();
    
    let result;
    try { result = await sql`SELECT data FROM license_schema WHERE id = 'main'`; } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    if (rows.length === 0) {
      return NextResponse.json({ items: [], seeded: false });
    }
    
    let items = rows[0].data as any[];
    if (userCorporateId) {
      items = filterCategoriesByEntity(items, userCorporateId, ancestorCorporateIds);
    }
    
    return NextResponse.json({ items, seeded: true });
  } catch (error) {
    console.error('Failed to fetch license schema:', error);
    return NextResponse.json({ items: [], seeded: false }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schemaArray = Array.isArray(body) ? body : [body];
    const jsonData = JSON.stringify(schemaArray);
    await sql`INSERT INTO license_schema (id, data, updated_at) VALUES ('main', ${jsonData}::jsonb, NOW())
              ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save license schema:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
