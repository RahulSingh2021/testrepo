import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const SEED_BRANDS = [
  { name: 'UNILEVER', description: 'Global FMCG — food, beverage, cleaning & personal care', status: 'Active' },
  { name: 'NESTLE', description: 'Dairy, confectionery, beverages & nutrition products', status: 'Active' },
  { name: 'KRAFT HEINZ', description: 'Condiments, sauces, dairy and packaged foods', status: 'Active' },
  { name: 'MONDELEZ', description: 'Snacks, biscuits, chocolates and confectionery', status: 'Active' },
  { name: 'PEPSI CO', description: 'Beverages, snacks and food products', status: 'Active' },
  { name: 'COCA-COLA', description: 'Carbonated soft drinks, juices and water', status: 'Active' },
  { name: 'DANONE', description: 'Dairy, plant-based products and specialised nutrition', status: 'Active' },
  { name: 'MARS FOOD', description: 'Confectionery, pet food and food products', status: 'Active' },
  { name: 'KELLOGGS', description: 'Breakfast cereals, snacks and convenience foods', status: 'Active' },
  { name: 'GENERAL MILLS', description: 'Cereal, yogurt, baking mixes and snack bars', status: 'Active' },
  { name: 'CONAGRA BRANDS', description: 'Frozen, refrigerated and shelf-stable foods', status: 'Pending' },
  { name: 'CAMPBELL SOUP', description: 'Soups, sauces, beverages and baked snacks', status: 'Active' },
];

export async function POST(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      corporate_id TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const count = parseInt(((await sql`SELECT COUNT(*) as cnt FROM brands`) as any[])[0]?.cnt || '0', 10);
    if (count > 0) {
      return NextResponse.json({ message: `Database already has ${count} brands. Skipped seeding.`, count });
    }

    const now = new Date().toISOString().split('T')[0];
    const items = SEED_BRANDS.map((b, i) => ({
      id: `seed-brand-${i + 1}`,
      name: b.name,
      description: b.description,
      status: b.status,
      logo: '',
      addedByUnitId: 'system',
      addedByUnitName: 'Corporate HQ',
      addedByUserName: 'System Admin',
      supplierIds: [],
      adoptedByUnitIds: [],
      createdAt: now,
      corporateId: null,
    }));

    for (const item of items) {
      const { id, corporateId, ...data } = item;
      await sql`INSERT INTO brands (id, corporate_id, data, updated_at)
                VALUES (${id}, ${corporateId}, ${JSON.stringify(data)}::jsonb, NOW())
                ON CONFLICT (id) DO NOTHING`;
    }

    return NextResponse.json({ success: true, seeded: items.length, message: `Seeded ${items.length} brands successfully` });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to this endpoint to seed initial brand data' });
}
