import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import fs from 'fs';
import path from 'path';

async function exportTable(table: string): Promise<any[]> {
  let result: any;
  switch (table) {
    case 'entities': result = await sql`SELECT id, data FROM entities ORDER BY id`; break;
    case 'users': result = await sql`SELECT id, data FROM users ORDER BY id`; break;
    case 'trainers': result = await sql`SELECT id, data FROM trainers ORDER BY id`; break;
    case 'training_calendar': result = await sql`SELECT id, data FROM training_calendar ORDER BY id`; break;
    case 'audit_checklists': result = await sql`SELECT id, data FROM audit_checklists ORDER BY id`; break;
    case 'audit_tasks': result = await sql`SELECT id, data FROM audit_tasks ORDER BY id`; break;
    case 'audit_schedules': result = await sql`SELECT id, data FROM audit_schedules ORDER BY id`; break;
    case 'audit_unit_schedules': result = await sql`SELECT id, data FROM audit_unit_schedules ORDER BY id`; break;
    case 'facility_checklists': result = await sql`SELECT id, data FROM facility_checklists ORDER BY id`; break;
    case 'ingredients': result = await sql`SELECT id, data FROM ingredients ORDER BY id`; break;
    case 'license_schema': result = await sql`SELECT id, data FROM license_schema ORDER BY id`; break;
    case 'recipes': result = await sql`SELECT id, data FROM recipes ORDER BY id`; break;
    case 'vendor_checklists': result = await sql`SELECT id, data FROM vendor_checklists ORDER BY id`; break;
    case 'fst_members': result = await sql`SELECT id, data FROM fst_members ORDER BY id`; break;
    case 'protocols': result = await sql`SELECT id, data FROM protocols ORDER BY id`; break;
    case 'observations': result = await sql`SELECT id, data FROM observations ORDER BY id`; break;
    case 'audit_reports': result = await sql`SELECT id, type, data FROM audit_reports`; break;
    default: return [];
  }
  return Array.isArray(result) ? result : [];
}

const JSONB_TABLES = [
  'entities', 'users', 'trainers', 'training_calendar',
  'audit_checklists', 'audit_tasks', 'audit_schedules', 'audit_unit_schedules',
  'facility_checklists', 'ingredients', 'license_schema', 'recipes', 'vendor_checklists',
  'fst_members', 'protocols', 'observations'
];

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Sync export is disabled in production.' }, { status: 403 });
  }

  const { action } = await request.json().catch(() => ({ action: 'export' }));

  if (action === 'export') {
    try {
      const syncDir = path.join(process.cwd(), 'lib', 'sync-data');
      if (!fs.existsSync(syncDir)) fs.mkdirSync(syncDir, { recursive: true });

      const results: Record<string, number> = {};

      for (const table of [...JSONB_TABLES, 'audit_reports']) {
        try {
          const rows = await exportTable(table);
          const data = rows.map((r: any) => {
            if (table === 'audit_reports') return { id: r.id, type: r.type, data: r.data };
            return { id: r.id, data: r.data };
          });
          fs.writeFileSync(path.join(syncDir, `${table}.json`), JSON.stringify(data));
          results[table] = data.length;
        } catch (e: any) {
          results[table] = -1;
          console.error(`[sync-export] Error exporting ${table}:`, e.message);
        }
      }

      try {
        const emailRows = await sql`SELECT auditor_name, unit_name, audit_names, locations, start_date, end_date, period_frequency, status FROM audit_email_log ORDER BY id`;
        fs.writeFileSync(path.join(syncDir, 'audit_email_log.json'), JSON.stringify(emailRows));
        results['audit_email_log'] = emailRows.length;
      } catch (e: any) {
        results['audit_email_log'] = -1;
      }

      return NextResponse.json({ success: true, action: 'export', results });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action. Use "export".' }, { status: 400 });
}
