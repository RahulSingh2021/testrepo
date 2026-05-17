import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureSupplierTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const ensureRawMaterialsTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS raw_materials (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'ingredients',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const ensureSubmissionsTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS supplier_submissions (
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

async function resolveSupplier(token: string): Promise<any | null> {
  await ensureSupplierTable();
  const count = await sql`SELECT COUNT(*)::int as cnt FROM suppliers`;
  const cnt = count?.[0]?.cnt ?? 0;
  if (cnt === 0) return null;
  const supplierRows = await safeSelect(sql`SELECT id, data FROM suppliers ORDER BY updated_at DESC`);
  const allSuppliers = supplierRows.map((r: any) => ({ id: r.id, ...r.data }));
  return allSuppliers.find((s: any) =>
    s.id === token || s.id === `supplier-${token}` || s.name?.toLowerCase().replace(/\s+/g, '-') === token.toLowerCase()
  ) || null;
}

async function resolvePortalData(supplier: any) {
  await ensureRawMaterialsTable();
  const matCount = await sql`SELECT COUNT(*)::int as cnt FROM raw_materials`;
  const mCount = matCount?.[0]?.cnt ?? 0;
  let filteredMaterials: any[] = [];
  if (mCount > 0) {
    const matRows = await safeSelect(sql`SELECT id, data FROM raw_materials ORDER BY updated_at DESC`);
    const allMaterials = matRows.map((r: any) => ({ id: r.id, ...r.data }));
    filteredMaterials = allMaterials.filter((m: any) => {
      if (!m.vendors || !Array.isArray(m.vendors)) return false;
      return m.vendors.some((v: string) => v.toUpperCase() === supplier.name.toUpperCase());
    });
  }

  await ensureSubmissionsTable();
  const subCount = await sql`SELECT COUNT(*)::int as cnt FROM supplier_submissions`;
  const sCount = subCount?.[0]?.cnt ?? 0;
  let filteredSubmissions: any[] = [];
  if (sCount > 0) {
    const subRows = await safeSelect(sql`SELECT id, data FROM supplier_submissions ORDER BY updated_at DESC`);
    const allSubmissions = subRows.map((r: any) => ({ id: r.id, ...r.data }));
    filteredSubmissions = allSubmissions.filter((s: any) =>
      s.supplierId === supplier.id && (!supplier.unitId || s.unitId === supplier.unitId)
    );
  }

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      unitId: supplier.unitId || '',
      unitName: supplier.locationPath || 'Unit',
      requiresPin: !!(supplier.portalPin && supplier.portalPin.length > 0),
    },
    materials: filteredMaterials.map((m: any) => ({
      name: m.name,
      brands: m.brands?.map((b: any) => ({ name: b.name })) || [],
    })),
    submissions: filteredSubmissions,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const supplier = await resolveSupplier(token);
    if (!supplier) {
      return NextResponse.json({ error: 'Invalid supplier portal link' }, { status: 404 });
    }

    if (supplier.portalPin && supplier.portalPin.length > 0) {
      return NextResponse.json({
        supplier: {
          id: supplier.id,
          name: supplier.name,
          unitId: supplier.unitId || '',
          unitName: supplier.locationPath || 'Unit',
          requiresPin: true,
        },
        materials: [],
        submissions: [],
      });
    }

    return NextResponse.json(await resolvePortalData(supplier));
  } catch (error) {
    console.error('Supplier portal data fetch failed:', error);
    return NextResponse.json({ error: 'Failed to load portal data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, pin } = await request.json();
    if (!token || !pin) {
      return NextResponse.json({ error: 'Token and PIN are required' }, { status: 400 });
    }

    const supplier = await resolveSupplier(token);
    if (!supplier) {
      return NextResponse.json({ error: 'Invalid supplier portal link' }, { status: 404 });
    }

    if (!supplier.portalPin || supplier.portalPin !== pin) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }

    return NextResponse.json(await resolvePortalData(supplier));
  } catch (error) {
    console.error('Supplier portal PIN verify failed:', error);
    return NextResponse.json({ error: 'Failed to verify PIN' }, { status: 500 });
  }
}
