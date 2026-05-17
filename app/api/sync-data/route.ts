import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const JSONB_TABLES = [
  'entities', 'users', 'trainers', 'training_calendar', 'observations',
  'audit_checklists', 'audit_tasks', 'audit_schedules', 'audit_unit_schedules',
  'facility_checklists', 'ingredients', 'license_schema', 'recipes', 'vendor_checklists'
];

async function upsertRow(table: string, id: string, jsonData: string) {
  switch (table) {
    case 'entities':
      await sql`INSERT INTO entities (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'users':
      await sql`INSERT INTO users (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'trainers':
      await sql`INSERT INTO trainers (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'training_calendar':
      await sql`INSERT INTO training_calendar (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'observations':
      await sql`INSERT INTO observations (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'audit_checklists':
      await sql`INSERT INTO audit_checklists (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'audit_tasks':
      await sql`INSERT INTO audit_tasks (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'audit_schedules':
      await sql`INSERT INTO audit_schedules (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'audit_unit_schedules':
      await sql`INSERT INTO audit_unit_schedules (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'facility_checklists':
      await sql`INSERT INTO facility_checklists (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'ingredients':
      await sql`INSERT INTO ingredients (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'license_schema':
      await sql`INSERT INTO license_schema (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'recipes':
      await sql`INSERT INTO recipes (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'vendor_checklists':
      await sql`INSERT INTO vendor_checklists (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, items } = body;

    if (!table || !JSONB_TABLES.includes(table)) {
      return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: true, synced: 0 });
    }

    let synced = 0;
    const BATCH = 50;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      await Promise.all(batch.map(async (item: any) => {
        const id = String(item.id);
        const data = item.data || {};
        const jsonData = JSON.stringify(data);
        await upsertRow(table, id, jsonData);
        synced++;
      }));
    }

    return NextResponse.json({ success: true, synced, total: items.length });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const counts: Record<string, number> = {};
    for (const table of JSONB_TABLES) {
      try {
        let result;
        switch (table) {
          case 'entities': result = await sql`SELECT count(*)::int as c FROM entities`; break;
          case 'users': result = await sql`SELECT count(*)::int as c FROM users`; break;
          case 'trainers': result = await sql`SELECT count(*)::int as c FROM trainers`; break;
          case 'training_calendar': result = await sql`SELECT count(*)::int as c FROM training_calendar`; break;
          case 'observations': result = await sql`SELECT count(*)::int as c FROM observations`; break;
          case 'audit_checklists': result = await sql`SELECT count(*)::int as c FROM audit_checklists`; break;
          case 'audit_tasks': result = await sql`SELECT count(*)::int as c FROM audit_tasks`; break;
          case 'audit_schedules': result = await sql`SELECT count(*)::int as c FROM audit_schedules`; break;
          case 'audit_unit_schedules': result = await sql`SELECT count(*)::int as c FROM audit_unit_schedules`; break;
          case 'facility_checklists': result = await sql`SELECT count(*)::int as c FROM facility_checklists`; break;
          case 'ingredients': result = await sql`SELECT count(*)::int as c FROM ingredients`; break;
          case 'license_schema': result = await sql`SELECT count(*)::int as c FROM license_schema`; break;
          case 'recipes': result = await sql`SELECT count(*)::int as c FROM recipes`; break;
          case 'vendor_checklists': result = await sql`SELECT count(*)::int as c FROM vendor_checklists`; break;
        }
        counts[table] = result?.[0]?.c ?? 0;
      } catch { counts[table] = -1; }
    }
    return NextResponse.json({ counts });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
