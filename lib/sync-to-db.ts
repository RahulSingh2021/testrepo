import sql from '@/lib/db';
import fs from 'fs';
import path from 'path';

const JSONB_TABLES = [
  'entities', 'users', 'trainers', 'training_calendar',
  'audit_checklists', 'audit_tasks', 'audit_schedules', 'audit_unit_schedules',
  'facility_checklists', 'ingredients', 'license_schema', 'recipes', 'vendor_checklists',
  'fst_members', 'protocols',
  // NOTE: 'observations' is intentionally NOT in this list.
  // The dev-seed `lib/sync-data/observations.json` file used to be upserted
  // here on every SYNC_VERSION bump using `ON CONFLICT (id) DO UPDATE SET
  // data = …`, which silently overwrote production share-link closures
  // (status RESOLVED → seed status OPEN, plus loss of closureComments /
  // afterImage). Audit-sourced observations are still persisted by
  // `runAuditObsSync()` below using `ON CONFLICT (id) DO NOTHING`, so
  // existing rows are never clobbered.
];

const MERGE_ONLY_TABLES = new Set([
  'entities', 'users', 'suppliers', 'raw_materials', 'brands',
  'trainers', 'training_calendar', 'fst_members', 'protocols', 'observations',
  'audit_reports', 'training_portal_links', 'document_specifications',
  // Recipes are user-created in production (often hundreds per unit) and
  // must NEVER be pruned by the dev→prod startup sync. Keep this in the
  // merge-only set so deleteRemovedRows() is skipped for the recipes table
  // on every publish — the sync will only upsert dev-seed recipes, leaving
  // every production-created recipe intact.
  'recipes',
]);

const TABLE_SCHEMAS: Record<string, string> = {
  entities: `CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  users: `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  trainers: `CREATE TABLE IF NOT EXISTS trainers (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  training_calendar: `CREATE TABLE IF NOT EXISTS training_calendar (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  audit_checklists: `CREATE TABLE IF NOT EXISTS audit_checklists (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  audit_tasks: `CREATE TABLE IF NOT EXISTS audit_tasks (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  audit_schedules: `CREATE TABLE IF NOT EXISTS audit_schedules (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  audit_unit_schedules: `CREATE TABLE IF NOT EXISTS audit_unit_schedules (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  facility_checklists: `CREATE TABLE IF NOT EXISTS facility_checklists (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  ingredients: `CREATE TABLE IF NOT EXISTS ingredients (id BIGINT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  license_schema: `CREATE TABLE IF NOT EXISTS license_schema (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  recipes: `CREATE TABLE IF NOT EXISTS recipes (id BIGINT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  vendor_checklists: `CREATE TABLE IF NOT EXISTS vendor_checklists (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  fst_members: `CREATE TABLE IF NOT EXISTS fst_members (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  protocols: `CREATE TABLE IF NOT EXISTS protocols (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  observations: `CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  document_specifications: `CREATE TABLE IF NOT EXISTS document_specifications (id TEXT PRIMARY KEY, scope TEXT, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  audit_email_log: `CREATE TABLE IF NOT EXISTS audit_email_log (id SERIAL PRIMARY KEY, auditor_name TEXT NOT NULL, unit_name TEXT NOT NULL, audit_names TEXT NOT NULL, locations TEXT, start_date TEXT, end_date TEXT, period_frequency TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
  whatsapp_messages: `CREATE TABLE IF NOT EXISTS whatsapp_messages (
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
  )`,
  whatsapp_messages_idx_phone: `CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_created_idx ON whatsapp_messages(phone, created_at DESC)`,
  whatsapp_messages_idx_unread: `CREATE INDEX IF NOT EXISTS whatsapp_messages_unread_idx ON whatsapp_messages(phone) WHERE direction = 'in' AND read_by_admin = FALSE`,
};

let syncCompleted = false;

const SYNC_VERSION = 'v16_20260401_backfill_rm_corporate_ids';
const SYNC_VERSION_KEY = 'sync_version';

async function execRawSQL(query: string) {
  const strings = Object.assign([query], { raw: [query] });
  return sql(strings as TemplateStringsArray);
}

async function ensureAllTables() {
  for (const [, ddl] of Object.entries(TABLE_SCHEMAS)) {
    try {
      await execRawSQL(ddl);
    } catch (err) {
      console.error('[sync] Table creation error:', err);
    }
  }
}

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
      await sql`INSERT INTO ingredients (id, data, updated_at) VALUES (${id}::bigint, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'license_schema':
      await sql`INSERT INTO license_schema (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'recipes':
      await sql`INSERT INTO recipes (id, data, updated_at) VALUES (${id}::bigint, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'vendor_checklists':
      await sql`INSERT INTO vendor_checklists (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'fst_members':
      await sql`INSERT INTO fst_members (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'protocols':
      await sql`INSERT INTO protocols (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
    case 'observations':
      await sql`INSERT INTO observations (id, data, updated_at) VALUES (${id}, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      break;
  }
}

async function getDbIds(table: string): Promise<string[]> {
  let rows: any[];
  switch (table) {
    case 'entities': rows = await sql`SELECT id FROM entities`; break;
    case 'users': rows = await sql`SELECT id FROM users`; break;
    case 'trainers': rows = await sql`SELECT id FROM trainers`; break;
    case 'training_calendar': rows = await sql`SELECT id FROM training_calendar`; break;
    case 'audit_checklists': rows = await sql`SELECT id FROM audit_checklists`; break;
    case 'audit_tasks': rows = await sql`SELECT id FROM audit_tasks`; break;
    case 'audit_schedules': rows = await sql`SELECT id FROM audit_schedules`; break;
    case 'audit_unit_schedules': rows = await sql`SELECT id FROM audit_unit_schedules`; break;
    case 'facility_checklists': rows = await sql`SELECT id FROM facility_checklists`; break;
    case 'ingredients': rows = await sql`SELECT id FROM ingredients`; break;
    case 'license_schema': rows = await sql`SELECT id FROM license_schema`; break;
    case 'recipes': rows = await sql`SELECT id FROM recipes`; break;
    case 'vendor_checklists': rows = await sql`SELECT id FROM vendor_checklists`; break;
    case 'fst_members': rows = await sql`SELECT id FROM fst_members`; break;
    case 'protocols': rows = await sql`SELECT id FROM protocols`; break;
    case 'observations': rows = await sql`SELECT id FROM observations`; break;
    default: rows = [];
  }
  return Array.isArray(rows) ? rows.map((r: any) => String(r.id)) : [];
}

async function deleteRow(table: string, id: string) {
  switch (table) {
    case 'entities': await sql`DELETE FROM entities WHERE id = ${id}`; break;
    case 'users': await sql`DELETE FROM users WHERE id = ${id}`; break;
    case 'trainers': await sql`DELETE FROM trainers WHERE id = ${id}`; break;
    case 'training_calendar': await sql`DELETE FROM training_calendar WHERE id = ${id}`; break;
    case 'audit_checklists': await sql`DELETE FROM audit_checklists WHERE id = ${id}`; break;
    case 'audit_tasks': await sql`DELETE FROM audit_tasks WHERE id = ${id}`; break;
    case 'audit_schedules': await sql`DELETE FROM audit_schedules WHERE id = ${id}`; break;
    case 'audit_unit_schedules': await sql`DELETE FROM audit_unit_schedules WHERE id = ${id}`; break;
    case 'facility_checklists': await sql`DELETE FROM facility_checklists WHERE id = ${id}`; break;
    case 'ingredients': await sql`DELETE FROM ingredients WHERE id = ${id}::bigint`; break;
    case 'license_schema': await sql`DELETE FROM license_schema WHERE id = ${id}`; break;
    case 'recipes': await sql`DELETE FROM recipes WHERE id = ${id}::bigint`; break;
    case 'vendor_checklists': await sql`DELETE FROM vendor_checklists WHERE id = ${id}`; break;
    case 'fst_members': await sql`DELETE FROM fst_members WHERE id = ${id}`; break;
    case 'protocols': await sql`DELETE FROM protocols WHERE id = ${id}`; break;
    case 'observations': await sql`DELETE FROM observations WHERE id = ${id}`; break;
  }
}

async function getSyncVersion(): Promise<string | null> {
  try {
    await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const rows = await sql`SELECT value FROM sync_meta WHERE key = ${SYNC_VERSION_KEY}`;
    return rows[0]?.value || null;
  } catch {
    return null;
  }
}

async function setSyncVersion(version: string): Promise<boolean> {
  try {
    await sql`INSERT INTO sync_meta (key, value) VALUES (${SYNC_VERSION_KEY}, ${version})
              ON CONFLICT (key) DO UPDATE SET value = ${version}`;
    const verify = await sql`SELECT value FROM sync_meta WHERE key = ${SYNC_VERSION_KEY}`;
    return verify[0]?.value === version;
  } catch (e) {
    console.error('[sync] Failed to set sync version:', e);
    return false;
  }
}

async function deleteRemovedRows(table: string, fileIds: Set<string>) {
  try {
    const dbIds = await getDbIds(table);
    const toDelete = dbIds.filter(id => !fileIds.has(id));
    for (const id of toDelete) {
      await deleteRow(table, id);
    }
    if (toDelete.length > 0) {
      console.log(`[sync] ${table}: deleted ${toDelete.length} rows not in sync data`);
    }
  } catch (e) {
    console.error(`[sync] Error deleting removed rows from ${table}:`, e);
  }
}

// All dev-seed IDs per table that may have been pushed to production before the guard was added.
// Safe to delete: auto-generated in dev, will never collide with real user-created IDs in production.
const DEV_SEED_IDS: Record<string, string[]> = {
  audit_checklists: [
    'CL-1772451136204','CL-1772506331270','CL-1772514258083','CL-1772517817225',
    'CL-1773423189885','from-mcl-CL-1772983273212','from-mcl-CL-1773384314875',
    'm1','m2','m3','m4',
  ],
  audit_tasks: [
    'sched-P-1772521473513-A-1772521632426-Jane-Smith-Main-Kitchen---k1',
    'sched-P-1772521473513-A-1772521632426-Jane-Smith-Main-Kitchen---k2',
    'sched-P-1772521473513-A-1772521632426-Sarah-Connor-Main-Kitchen---k3',
    'sched-P-1772521473513-A-1772521632426-Sarah-Connor-Main-Kitchen---k4',
    'sched-P-1772521473513-A-1772521632426-Sarah-Connor-Receiving-Bay',
    'sched-P-1772529602227-A-1772529628839-Jane-Smith-Main-Kitchen---k7',
    'sched-P-1772529602227-A-1772529628839-Sarah-Connor-Main-Kitchen---k6',
    'sched-P-1772529602227-A-1772529628839-Sarah-Connor-Receiving-Bay',
    'sched-P-1772529980662-A-1772530004011-Jane-Smith-Main-Kitchen---k7',
    'sched-P-1772529980662-A-1772530004011-Sarah-Connor-Main-Kitchen---k2',
    'sched-P-1772529980662-A-1772530004011-Sarah-Connor-Receiving-Bay',
    'sched-P-1772531190192-A-1772531216738-Jane-Smith-Main-Kitchen---Shree2',
    'sched-P-1772531190192-A-1772531216738-Sarah-Connor-Main-Kitchen---Shree1',
    'sched-P-1772531190192-A-1772531216738-Sarah-Connor-Receiving-Bay',
    'sched-P-1772536111789-A-1772536140356-Sarah-Connor-Main-Kitchen',
    'sched-P-1772536111789-A-1772536140356-Sarah-Connor-Receiving-Bay',
    'sched-P-1772536498457-A-1772536522436-Jane-Smith-Main-Kitchen---k12',
    'sched-P-1772536498457-A-1772536522436-Sarah-Connor-Main-Kitchen---Ki1',
    'sched-P-1772536498457-A-1772536522436-Sarah-Connor-Receiving-Bay',
    'sched-P-1772539263888-A-1772539314759-Jane-Smith-Main-Kitchen---rash-3',
    'sched-P-1772539263888-A-1772539314759-Sarah-Connor-Main-Kitchen---Ras1',
    'sched-P-1772539263888-A-1772539314759-Sarah-Connor-Main-Kitchen---Ras2',
    'sched-P-1772539263888-A-1772539314759-Sarah-Connor-Receiving-Bay',
    'sched-P-1772541180348-A-1772541212775-Jane-Smith-Main-Kitchen---Rash2',
    'sched-P-1772541180348-A-1772541212775-Sarah-Connor-Main-Kitchen---Rash1',
    'sched-P-1772541180348-A-1772541212775-Sarah-Connor-Receiving-Bay',
    'sched-P-1772541542737-A-1772541571520-Jane-Smith-Main-Kitchen---Rash2',
    'sched-P-1772541542737-A-1772541571520-Sarah-Connor-Main-Kitchen---Rash1',
    'sched-P-1772541542737-A-1772541571520-Sarah-Connor-Receiving-Bay',
    'sched-P-1772544417623-A-1772544450705-Jane-Smith-Main-Kitchen---son2',
    'sched-P-1772544417623-A-1772544450705-Sarah-Connor-Main-Kitchen---Son1',
    'sched-P-1772544417623-A-1772544450705-Sarah-Connor-Receiving-Bay',
    'sched-P-1772581327573-A-1772581383282-Sarah-Connor-Main-Kitchen---par1',
    'sched-P-1772581327573-A-1772581383282-Sarah-Connor-Main-Kitchen---par2',
    'sched-P-1772581327573-A-1772581383282-Sarah-Connor-Receiving-Bay',
    'sched-P-1772583614005-A-1772583641288-Jane-Smith-Main-Kitchen---gol2',
    'sched-P-1772583614005-A-1772583641288-Sarah-Connor-Main-Kitchen---gol1',
    'sched-P-1772583614005-A-1772583641288-Sarah-Connor-Receiving-Bay',
    'sched-P-1773289375265-A-1773289569601-Ms-Garima-Patet-Food-Production',
    'sched-P-1773369170047-A-1773369185327-Mr.-Shreekant-Prasad-Food-Production',
  ],
  // audit_reports uses a composite PK (id, type) — handled separately below
};

const DEV_SEED_REPORT_IDS = [
  'sched-P-1773289375265-A-1773289569601-Ms-Garima-Patet-Food-Production',
  'CL-1772983273212',
  'sched-P-1773369170047-A-1773369185327-Mr.-Shreekant-Prasad-Food-Production',
];

// One-time production observations cleanup (May 2026):
// Delete every observation EXCEPT those from Jai Mahal Palace created on
// 2026-05-13. Idempotent via the sync_meta flag below — once the flag is
// set, this never runs again. After the next prod deploy, this whole
// function (and its call site in syncDevDataToDb) can be removed.
const OBS_PURGE_FLAG_KEY = 'obs_purge_2026_05_13';
async function runOneTimeObservationPurge() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const flagRows: any = await sql`SELECT value FROM sync_meta WHERE key = ${OBS_PURGE_FLAG_KEY}`;
    if (Array.isArray(flagRows) && flagRows.length > 0) {
      console.log('[sync] Observation purge already applied — skipping');
      return;
    }
    const before: any = await sql`SELECT COUNT(*)::int AS n FROM observations`;
    const beforeCount = Array.isArray(before) && before.length > 0 ? Number(before[0].n) : -1;
    const deleted: any = await sql`
      DELETE FROM observations
      WHERE NOT (
        (data::text ILIKE '%jai mahal%' OR data::text ILIKE '%jai-mahal%')
        AND (data->>'createdDate' LIKE '2026-05-13%')
      )
      RETURNING id
    `;
    const deletedCount = Array.isArray(deleted) ? deleted.length : 0;
    const after: any = await sql`SELECT COUNT(*)::int AS n FROM observations`;
    const afterCount = Array.isArray(after) && after.length > 0 ? Number(after[0].n) : -1;
    await sql`
      INSERT INTO sync_meta (key, value)
      VALUES (${OBS_PURGE_FLAG_KEY}, ${new Date().toISOString()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    console.log(`[sync] Observation purge: deleted ${deletedCount} rows (before=${beforeCount}, after=${afterCount}). Kept only Jai Mahal Palace observations from 2026-05-13.`);
  } catch (e) {
    console.error('[sync] One-time observation purge failed (non-fatal):', e);
  }
}

let prodCleanupDone = false;
async function cleanupProdDevSeedData() {
  if (prodCleanupDone) return;
  prodCleanupDone = true;
  try {
    let totalRemoved = 0;

    // Clean each standard table (single TEXT primary key)
    for (const [table, ids] of Object.entries(DEV_SEED_IDS)) {
      try {
        await execRawSQL(`CREATE TABLE IF NOT EXISTS ${table} (
          id TEXT PRIMARY KEY, data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        )`);
        for (const id of ids) {
          try {
            const res = await sql`DELETE FROM ${sql(table)} WHERE id = ${id} RETURNING id`;
            if (Array.isArray(res) && res.length > 0) totalRemoved++;
          } catch { /* row didn't exist — ignore */ }
        }
      } catch (e) {
        console.error(`[sync] Cleanup error for ${table} (non-fatal):`, e);
      }
    }

    // audit_reports has composite PK (id TEXT, type TEXT) — delete by id only
    try {
      await sql`CREATE TABLE IF NOT EXISTS audit_reports (
        id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'report',
        data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, type)
      )`;
      for (const id of DEV_SEED_REPORT_IDS) {
        try {
          const res = await sql`DELETE FROM audit_reports WHERE id = ${id} RETURNING id`;
          if (Array.isArray(res) && res.length > 0) totalRemoved++;
        } catch { /* row didn't exist — ignore */ }
      }
    } catch (e) {
      console.error('[sync] Cleanup error for audit_reports (non-fatal):', e);
    }

    if (totalRemoved > 0) {
      console.log(`[sync] Production cleanup: removed ${totalRemoved} dev-seed record(s) from audit tables`);
    } else {
      console.log('[sync] Production cleanup: no dev-seed records found (already clean)');
    }
  } catch (e) {
    console.error('[sync] Production cleanup error (non-fatal):', e);
  }
}

// One-time backfill: copy historical promo sends (recorded by the
// background blast worker in `whatsapp_promo_recipients`) into the
// `whatsapp_messages` inbox table. The Inbox UI was added in this same
// release, so promo blasts that ran BEFORE that release have no row in
// `whatsapp_messages` and never appear in the inbox.
//
// Idempotent: each backfilled row uses a synthetic wamid of
// `backfill:promo:<recipient_id>` and the table has a UNIQUE constraint
// on `wamid`, so re-runs collapse to a no-op via ON CONFLICT DO NOTHING.
// Status='read' so backfilled rows don't pollute the unread-count badge.
async function runWhatsappPromoBackfill() {
  try {
    const rows: any = await sql`
      SELECT r.id, r.phone, r.name,
             to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
             j.payload->>'topic' AS topic
        FROM whatsapp_promo_recipients r
        JOIN whatsapp_promo_jobs j ON j.id = r.job_id
       WHERE r.status = 'sent'
         AND NOT EXISTS (
           SELECT 1 FROM whatsapp_messages m
            WHERE m.wamid = ('backfill:promo:' || r.id::text)
         )
       LIMIT 5000
    `;
    if (!Array.isArray(rows) || rows.length === 0) {
      return;
    }
    let inserted = 0;
    for (const r of rows) {
      const wamid = `backfill:promo:${r.id}`;
      const body = r.topic
        ? `Training promo: ${r.topic}`
        : 'Training promo (template send)';
      // updated_at comes in as a pre-formatted ISO string (see SELECT above)
      // because the neon serverless driver was nulling out the raw timestamptz
      // value. Fall back to a NOW() insert if anything looks off.
      let createdAtIso: string | null = null;
      const ua = r.updated_at;
      if (typeof ua === 'string' && ua.length > 0) {
        const parsed = new Date(ua);
        if (!isNaN(parsed.getTime())) createdAtIso = parsed.toISOString();
      }
      try {
        if (createdAtIso) {
          await sql`
            INSERT INTO whatsapp_messages
              (wamid, direction, phone, contact_name, message_type, body,
               template_name, status, error, raw, read_by_admin, created_at)
            VALUES
              (${wamid}, 'out', ${r.phone}, ${r.name || null}, 'template', ${body},
               'training_session_scheduled', 'sent', NULL,
               ${JSON.stringify({ backfill: true, recipientId: String(r.id) })}::jsonb,
               TRUE, ${createdAtIso}::timestamptz)
            ON CONFLICT (wamid) DO NOTHING
          `;
        } else {
          await sql`
            INSERT INTO whatsapp_messages
              (wamid, direction, phone, contact_name, message_type, body,
               template_name, status, error, raw, read_by_admin)
            VALUES
              (${wamid}, 'out', ${r.phone}, ${r.name || null}, 'template', ${body},
               'training_session_scheduled', 'sent', NULL,
               ${JSON.stringify({ backfill: true, recipientId: String(r.id) })}::jsonb,
               TRUE)
            ON CONFLICT (wamid) DO NOTHING
          `;
        }
        inserted++;
      } catch (err) {
        console.warn('[sync] whatsapp promo backfill row failed (non-fatal)', err);
      }
    }
    if (inserted > 0) {
      console.log(`[sync] Backfilled ${inserted} historical WhatsApp promo sends into inbox`);
    }
  } catch (err) {
    // Worker tables may not exist on a fresh DB — that's fine.
    if (!String(err || '').includes('does not exist')) {
      console.error('[sync] WhatsApp promo backfill failed (non-fatal):', err);
    }
  }
}

// One-shot production cleanup for the 232 recipes that were misattributed
// to Jai Mahal Palace's owner_id (`ent-1772601398397`) by the Act-As scope-
// switch race in components/RecipeCalculation.tsx (root cause patched in
// the same release that introduces this cleanup).
//
// Strategy (approved by user, no dedupe):
//   - Snapshot every row currently under that owner into
//     `recipes_backup_20260511_jaimahal_cleanup` (full row backup, NEVER
//     deleted by this code). If the run needs to be reversed, copy
//     owner_id back from the backup table.
//   - Reassign owner_id to the legitimate owner per unitName / corp:
//       The Leela Palace Bengaluru        -> ent-1776349566791  (185 rows)
//       (empty unit) + corp Hyatt Gurugram -> ent-1778251998601 ( 31 rows)
//       Le Méridien Gurgaon, Delhi NCR   -> ent-1776500647427  ( 12 rows)
//       Default Unit                       -> 'unknown'           (  4 rows)
//   - The 3 legitimately-Jai-Mahal recipes (unitName = 'Jai Mahal Palace ')
//     stay where they are.
//
// Self-gated by its own sync_meta marker so it only runs once per database,
// and called from BOTH the already-synced and needs-sync branches so it
// executes on the next production startup regardless of the main sync
// version state.
const JAI_MAHAL_CLEANUP_KEY = 'cleanup_v17_jaimahal_owner_20260511';
const DEFAULT_ORPHAN_CLEANUP_KEY = 'cleanup_v18_default_corporate_orphans_20260514';
async function runJaiMahalOwnerCleanup() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const already = await sql`SELECT value FROM sync_meta WHERE key = ${JAI_MAHAL_CLEANUP_KEY}`;
    if (Array.isArray(already) && already.length > 0) {
      // Already executed on this database — never re-run (would create a
      // second backup table and is a no-op on the live data anyway since
      // the source rows were already moved).
      return;
    }

    // Don't run on a database that doesn't have the leak. The dev DB was
    // never affected; only production carries the misattributed rows.
    const leakedCount = await sql`
      SELECT count(*)::int AS cnt FROM recipes
      WHERE owner_id = 'ent-1772601398397'
        AND COALESCE(data->>'unitName','') <> 'Jai Mahal Palace '
    `;
    const cnt = (Array.isArray(leakedCount) && leakedCount[0]?.cnt) || 0;
    if (cnt === 0) {
      // Nothing to clean — record the marker anyway so we don't keep
      // probing on every startup.
      await sql`INSERT INTO sync_meta (key, value) VALUES (${JAI_MAHAL_CLEANUP_KEY}, ${'no-op'})
                ON CONFLICT (key) DO UPDATE SET value = ${'no-op'}`;
      return;
    }

    console.log(`[sync] Jai Mahal owner cleanup: found ${cnt} misattributed recipe(s), starting...`);

    // Backup table: full snapshot before any modification. Idempotent
    // CREATE protects against partial reruns if the marker write below
    // fails — the second run will see the table already exists and
    // proceed (still safe; UPDATEs are no-ops on the second pass since
    // the source rows have already been reassigned).
    await sql`
      CREATE TABLE IF NOT EXISTS recipes_backup_20260511_jaimahal_cleanup AS
        SELECT * FROM recipes WHERE owner_id = 'ent-1772601398397'
    `;
    const backupCount = await sql`SELECT count(*)::int AS cnt FROM recipes_backup_20260511_jaimahal_cleanup`;
    console.log(`[sync] Jai Mahal owner cleanup: backup table holds ${(Array.isArray(backupCount) && backupCount[0]?.cnt) || 0} rows`);

    // Reassign each leaked group to its legitimate owner. No DELETE — every
    // affected row continues to exist in the recipes table, just under a
    // different owner_id. The four UPDATEs are independent and disjoint.
    const r1 = await sql`
      UPDATE recipes SET owner_id = 'ent-1776349566791', updated_at = NOW()
      WHERE owner_id = 'ent-1772601398397'
        AND data->>'unitName' = 'The Leela Palace Bengaluru'
      RETURNING id
    `;
    const r2 = await sql`
      UPDATE recipes SET owner_id = 'ent-1778251998601', updated_at = NOW()
      WHERE owner_id = 'ent-1772601398397'
        AND COALESCE(data->>'unitName','') = ''
        AND data->>'corporateName' = 'Hyatt Gurugram'
      RETURNING id
    `;
    const r3 = await sql`
      UPDATE recipes SET owner_id = 'ent-1776500647427', updated_at = NOW()
      WHERE owner_id = 'ent-1772601398397'
        AND data->>'unitName' = 'Le Méridien Gurgaon, Delhi NCR'
      RETURNING id
    `;
    const r4 = await sql`
      UPDATE recipes SET owner_id = 'unknown', updated_at = NOW()
      WHERE owner_id = 'ent-1772601398397'
        AND data->>'unitName' = 'Default Unit'
      RETURNING id
    `;
    const moved =
      (Array.isArray(r1) ? r1.length : 0) +
      (Array.isArray(r2) ? r2.length : 0) +
      (Array.isArray(r3) ? r3.length : 0) +
      (Array.isArray(r4) ? r4.length : 0);

    const remaining = await sql`SELECT count(*)::int AS cnt FROM recipes WHERE owner_id = 'ent-1772601398397'`;
    const remainingCnt = (Array.isArray(remaining) && remaining[0]?.cnt) || 0;
    console.log(`[sync] Jai Mahal owner cleanup: reassigned ${moved} recipe(s) (Leela:${(Array.isArray(r1)?r1.length:0)}, Hyatt:${(Array.isArray(r2)?r2.length:0)}, LeMeridien:${(Array.isArray(r3)?r3.length:0)}, Default→unknown:${(Array.isArray(r4)?r4.length:0)}); ${remainingCnt} row(s) remain on Jai Mahal owner_id (expected: 3 legitimate Jai Mahal Palace recipes)`);

    await sql`INSERT INTO sync_meta (key, value) VALUES (${JAI_MAHAL_CLEANUP_KEY}, ${`done:moved=${moved}:remaining=${remainingCnt}`})
              ON CONFLICT (key) DO UPDATE SET value = ${`done:moved=${moved}:remaining=${remainingCnt}`}`;
  } catch (err) {
    // Non-fatal — leave the marker unset so the next startup retries.
    console.error('[sync] Jai Mahal owner cleanup failed (non-fatal, will retry next startup):', err);
  }
}

// One-shot quarantine for legacy "Default Corporate" / "Default Region" /
// "Default Unit" placeholder rows. Earlier code hard-coded those literal
// strings into the corporateName / regionalName / unitName fields of every
// brand-new recipe; combined with the per-unit fetch's `unitName = ANY(...)`
// clause those rows leaked across tenants. This pass:
//   1. Snapshots affected rows into a backup table (full data, no DELETE).
//   2. Reassigns owner_id to 'archived-defaults' so the per-owner fetch
//      branch and the legacy `'unknown'`-reclaim branch both stop
//      returning them. Super-admins still see them (their fetch has no
//      owner filter), so a human can triage / re-tag / delete from the UI.
//   3. Records a sync_meta marker so we never re-run.
// Self-gated by sync_meta and called from both startup branches so it
// executes on the next production deploy/restart regardless of sync state.
async function runDefaultOrphanCleanup() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const already = await sql`SELECT value FROM sync_meta WHERE key = ${DEFAULT_ORPHAN_CLEANUP_KEY}`;
    if (Array.isArray(already) && already.length > 0) return;

    // Match anything that was placeholder-tagged. Case-insensitive on the
    // off-chance someone wrote "default corporate" or "DEFAULT UNIT".
    const orphanCount = await sql`
      SELECT count(*)::int AS cnt FROM recipes
      WHERE (
        lower(btrim(COALESCE(data->>'corporateName',''))) = 'default corporate'
        OR lower(btrim(COALESCE(data->>'regionalName',''))) = 'default region'
        OR lower(btrim(COALESCE(data->>'unitName',''))) = 'default unit'
      )
      AND COALESCE(owner_id, '') NOT IN ('archived-defaults', 'super-admin')
    `;
    const cnt = (Array.isArray(orphanCount) && orphanCount[0]?.cnt) || 0;
    if (cnt === 0) {
      await sql`INSERT INTO sync_meta (key, value) VALUES (${DEFAULT_ORPHAN_CLEANUP_KEY}, ${'no-op'})
                ON CONFLICT (key) DO UPDATE SET value = ${'no-op'}`;
      return;
    }

    console.log(`[sync] Default-orphan cleanup: found ${cnt} placeholder-tagged recipe(s), starting...`);

    // Full snapshot of affected rows so a human can recover anything
    // mistakenly quarantined by reading from this backup table.
    await sql`
      CREATE TABLE IF NOT EXISTS recipes_backup_20260514_default_orphans AS
        SELECT * FROM recipes
        WHERE (
          lower(btrim(COALESCE(data->>'corporateName',''))) = 'default corporate'
          OR lower(btrim(COALESCE(data->>'regionalName',''))) = 'default region'
          OR lower(btrim(COALESCE(data->>'unitName',''))) = 'default unit'
        )
        AND COALESCE(owner_id, '') NOT IN ('archived-defaults', 'super-admin')
    `;
    const backupCount = await sql`SELECT count(*)::int AS cnt FROM recipes_backup_20260514_default_orphans`;
    console.log(`[sync] Default-orphan cleanup: backup table holds ${(Array.isArray(backupCount) && backupCount[0]?.cnt) || 0} rows`);

    const moved = await sql`
      UPDATE recipes SET owner_id = 'archived-defaults', updated_at = NOW()
      WHERE (
        lower(btrim(COALESCE(data->>'corporateName',''))) = 'default corporate'
        OR lower(btrim(COALESCE(data->>'regionalName',''))) = 'default region'
        OR lower(btrim(COALESCE(data->>'unitName',''))) = 'default unit'
      )
      AND COALESCE(owner_id, '') NOT IN ('archived-defaults', 'super-admin')
      RETURNING id
    `;
    const movedCnt = Array.isArray(moved) ? moved.length : 0;
    console.log(`[sync] Default-orphan cleanup: quarantined ${movedCnt} recipe(s) under owner_id='archived-defaults'`);

    await sql`INSERT INTO sync_meta (key, value) VALUES (${DEFAULT_ORPHAN_CLEANUP_KEY}, ${`done:moved=${movedCnt}`})
              ON CONFLICT (key) DO UPDATE SET value = ${`done:moved=${movedCnt}`}`;
  } catch (err) {
    console.error('[sync] Default-orphan cleanup failed (non-fatal, will retry next startup):', err);
  }
}

// One-shot recovery: re-assert RESOLVED status on observations whose
// share-link closure was silently undone by an earlier dev→prod sync run.
// Affected rows still have the closure payload preserved on
// `data.tracking` (entries tagged `closedVia: 'share-link'`) plus
// `closureComments` / `afterImage` — only `data.status` was reset to OPEN
// when the dev-seed observations.json was upserted on top of them. We
// scan for rows where the latest non-draft share-link tracking entry
// exists but status != RESOLVED, then restore status / closedAt /
// closureComments / afterImage from the tracking record.
//
// Self-gated by a `sync_meta` marker so it runs at most once per database
// (same pattern as runJaiMahalOwnerCleanup). Safe to call from both
// branches of syncDevDataToDb.
const SHARE_LINK_RECOVERY_KEY = 'cleanup_v18_sharelink_closure_recovery_20260511';
async function runShareLinkClosureRecovery() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const already = await sql`SELECT value FROM sync_meta WHERE key = ${SHARE_LINK_RECOVERY_KEY}`;
    if (Array.isArray(already) && already.length > 0) return;

    // Find rows whose tracking JSONB array contains at least one non-draft
    // share-link closure entry but whose top-level status is not RESOLVED.
    const rows = await sql`
      SELECT id, data FROM observations
      WHERE COALESCE(data->>'status','') <> 'RESOLVED'
        AND jsonb_typeof(data->'tracking') = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(data->'tracking') AS t
          WHERE t->>'closedVia' = 'share-link'
            AND COALESCE(t->>'isDraft','false') <> 'true'
        )
    `;
    const candidates = Array.isArray(rows) ? rows : [];
    if (candidates.length === 0) {
      await sql`INSERT INTO sync_meta (key, value) VALUES (${SHARE_LINK_RECOVERY_KEY}, ${'no-op'})
                ON CONFLICT (key) DO UPDATE SET value = ${'no-op'}`;
      return;
    }

    let recovered = 0;
    for (const row of candidates) {
      try {
        const data = { ...(row.data || {}) };
        const tracking: any[] = Array.isArray(data.tracking) ? data.tracking : [];
        // Pick the latest non-draft share-link tracking entry as the
        // authoritative closure record.
        const closures = tracking.filter(
          (t) => t && t.closedVia === 'share-link' && t.isDraft !== true && t.isDraft !== 'true'
        );
        if (closures.length === 0) continue;
        const latest = closures[closures.length - 1];

        const closureComments =
          (typeof latest.comments === 'string' && latest.comments) ||
          (typeof data.closureComments === 'string' && data.closureComments) ||
          '';
        const afterImage = data.afterImage || null;

        // Restore closedAt from the preserved tracking entry. The tracking
        // timestamp is a display string (e.g. "11 May 09:30 PM"); attempt
        // to parse it to ISO, otherwise persist the display string as-is
        // (still strictly better than overwriting with "now"). Only fall
        // back to NOW() when nothing at all is preserved.
        let restoredClosedAt: string | null = null;
        if (typeof data.closedAt === 'string' && data.closedAt) {
          restoredClosedAt = data.closedAt;
        } else if (typeof latest.timestamp === 'string' && latest.timestamp) {
          const parsed = new Date(latest.timestamp);
          restoredClosedAt = isNaN(parsed.getTime()) ? latest.timestamp : parsed.toISOString();
        } else {
          restoredClosedAt = new Date().toISOString();
        }

        const updated = {
          ...data,
          status: 'RESOLVED',
          closedAt: restoredClosedAt,
          closureComments,
          afterImage,
          lastUpdate: latest.timestamp || data.lastUpdate || restoredClosedAt,
        };
        const jsonStr = JSON.stringify(updated);
        await sql`UPDATE observations SET data = ${jsonStr}::jsonb, updated_at = NOW() WHERE id = ${row.id}`;
        recovered++;
      } catch (rowErr) {
        console.error(`[sync] share-link recovery row ${row.id} failed (non-fatal):`, rowErr);
      }
    }

    console.log(`[sync] Share-link closure recovery: re-asserted RESOLVED on ${recovered}/${candidates.length} observation(s)`);
    await sql`INSERT INTO sync_meta (key, value) VALUES (${SHARE_LINK_RECOVERY_KEY}, ${`done:recovered=${recovered}:scanned=${candidates.length}`})
              ON CONFLICT (key) DO UPDATE SET value = ${`done:recovered=${recovered}:scanned=${candidates.length}`}`;
  } catch (err) {
    console.error('[sync] Share-link closure recovery failed (non-fatal, will retry next startup):', err);
  }
}

// One-shot backfill: every existing recipe should be flagged as a
// sub-recipe so it is searchable / reusable as an ingredient inside
// other recipes (matches the new "every recipe is a locked sub-recipe"
// policy enforced in the Recipe Calculator UI). Self-gated by
// `sync_meta`; safe to call from every sync code path.
const RECIPES_SUBRECIPE_BACKFILL_KEY = 'cleanup_v19_recipes_subrecipe_backfill_20260511';
async function runRecipesSubRecipeBackfill() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const already = await sql`SELECT value FROM sync_meta WHERE key = ${RECIPES_SUBRECIPE_BACKFILL_KEY}`;
    if (Array.isArray(already) && already.length > 0) return;

    // jsonb_set with `true` (not '"true"') stores a real boolean, matching
    // how the app writes the field. Apply only to rows where it isn't
    // already true so updated_at and SQL work stay minimal.
    const result = await sql`
      UPDATE recipes
      SET data = jsonb_set(data, '{isSubRecipe}', 'true'::jsonb, true),
          updated_at = NOW()
      WHERE COALESCE((data->>'isSubRecipe')::boolean, false) <> true
      RETURNING id
    `;
    const updated = Array.isArray(result) ? result.length : 0;
    console.log(`[sync] Recipes sub-recipe backfill: flagged ${updated} recipe(s) as sub-recipe`);
    await sql`INSERT INTO sync_meta (key, value) VALUES (${RECIPES_SUBRECIPE_BACKFILL_KEY}, ${`done:updated=${updated}`})
              ON CONFLICT (key) DO UPDATE SET value = ${`done:updated=${updated}`}`;
  } catch (err) {
    console.error('[sync] Recipes sub-recipe backfill failed (non-fatal, will retry next startup):', err);
  }
}

// One-shot backfill: seed `aliasEntries` (the new structured aliases
// field used by the CSV matcher) from any pre-existing `keyword` /
// `aliases` data so curators don't lose their historical aliases when
// they open the new editor. Self-gated by `sync_meta`; only touches
// rows that have legacy data and no aliasEntries yet.
const INGREDIENT_ALIASES_BACKFILL_KEY = 'cleanup_v20_ingredient_aliases_backfill_20260511';
async function runIngredientAliasesBackfill() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const already = await sql`SELECT value FROM sync_meta WHERE key = ${INGREDIENT_ALIASES_BACKFILL_KEY}`;
    if (Array.isArray(already) && already.length > 0) return;

    // Only consider rows that have at least one legacy alias source AND
    // have no aliasEntries yet. Doing the comma-split + json shape in
    // SQL keeps this self-contained and avoids streaming ingredients
    // through Node.
    const rows = await sql`
      SELECT id, data FROM ingredients
      WHERE jsonb_typeof(data->'aliasEntries') IS DISTINCT FROM 'array'
        AND (
          (COALESCE(data->>'keyword','') <> '')
          OR jsonb_typeof(data->'aliases') = 'array'
        )
    `;
    const candidates = Array.isArray(rows) ? rows : [];
    if (candidates.length === 0) {
      await sql`INSERT INTO sync_meta (key, value) VALUES (${INGREDIENT_ALIASES_BACKFILL_KEY}, ${'no-op'})
                ON CONFLICT (key) DO UPDATE SET value = ${'no-op'}`;
      return;
    }

    let updated = 0;
    for (const row of candidates) {
      try {
        const data = { ...(row.data || {}) };
        const seen = new Set<string>();
        const entries: { text: string; exact?: boolean; priority?: boolean }[] = [];

        // Seed from legacy aliases array first (these are user-merged
        // duplicates so they're high-quality).
        if (Array.isArray(data.aliases)) {
          for (const a of data.aliases) {
            if (typeof a !== 'string') continue;
            const t = a.trim();
            const k = t.toLowerCase();
            if (!t || seen.has(k)) continue;
            seen.add(k);
            entries.push({ text: t });
          }
        }
        // Then comma-split the freeform keyword string.
        if (typeof data.keyword === 'string' && data.keyword.trim()) {
          for (const part of data.keyword.split(',')) {
            const t = part.trim();
            const k = t.toLowerCase();
            if (!t || seen.has(k)) continue;
            seen.add(k);
            entries.push({ text: t });
          }
        }
        if (entries.length === 0) continue;
        data.aliasEntries = entries;
        const jsonStr = JSON.stringify(data);
        await sql`UPDATE ingredients SET data = ${jsonStr}::jsonb, updated_at = NOW() WHERE id = ${row.id}::bigint`;
        updated++;
      } catch (rowErr) {
        console.error(`[sync] alias backfill row ${row.id} failed (non-fatal):`, rowErr);
      }
    }

    console.log(`[sync] Ingredient aliasEntries backfill: seeded ${updated}/${candidates.length} ingredient(s)`);
    await sql`INSERT INTO sync_meta (key, value) VALUES (${INGREDIENT_ALIASES_BACKFILL_KEY}, ${`done:updated=${updated}:scanned=${candidates.length}`})
              ON CONFLICT (key) DO UPDATE SET value = ${`done:updated=${updated}:scanned=${candidates.length}`}`;
  } catch (err) {
    console.error('[sync] Ingredient aliasEntries backfill failed (non-fatal, will retry next startup):', err);
  }
}

async function runAuditObsSync() {
  try {
    const existingCount = await sql`SELECT COUNT(*)::int as cnt FROM observations WHERE id LIKE 'IA-%'`;
    if (existingCount && Array.isArray(existingCount) && existingCount.length > 0 && (existingCount[0]?.cnt || 0) > 0) return;

    console.log('[sync] Running audit task observations → observations table sync...');
    const allTasks = await sql`SELECT id, data FROM audit_tasks`;
    const tasks = (Array.isArray(allTasks) ? allTasks : []).filter((t: any) => t.data && Array.isArray(t.data.observations) && t.data.observations.length > 0);

    const entityRows = await sql`SELECT id, data FROM entities`;
    const safeEntityRows = Array.isArray(entityRows) ? entityRows : [];
    const entityMap = new Map(safeEntityRows.map((e: any) => [e.id, { id: e.id, name: e.data?.name, type: e.data?.type, parent_id: e.data?.parentId }]));
    const entityByName = new Map<string, any>();
    safeEntityRows.forEach((e: any) => {
      if (e.data?.type === 'unit' && e.data?.name) entityByName.set(e.data.name.trim().toLowerCase(), { id: e.id, name: e.data.name, type: e.data.type, parent_id: e.data.parentId });
    });

    let totalSynced = 0;
    let globalIdx = 0;

    for (const task of (Array.isArray(tasks) ? tasks : [])) {
      const taskData = task.data;
      if (!taskData || !Array.isArray(taskData.observations) || taskData.observations.length === 0) continue;

      let unitEntity = entityMap.get(taskData.unitId);
      if (!unitEntity && taskData.unitName) {
        unitEntity = entityByName.get(taskData.unitName.trim().toLowerCase());
      }
      const resolvedUnitId = unitEntity?.id || taskData.unitId || '';
      const resolvedUnitName = unitEntity?.name || taskData.unitName || '';
      const regionalEntity = unitEntity?.parent_id ? entityMap.get(unitEntity.parent_id) : undefined;

      const completedDate = taskData.endTime || taskData.startTime || new Date().toISOString();
      let auditDateStr = '000000';
      try {
        const d = new Date(completedDate);
        auditDateStr = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(-2);
      } catch {}

      for (const obs of taskData.observations) {
        globalIdx++;
        const obsId = `IA-${auditDateStr}-${globalIdx + 1}`;
        if (existingSet.has(obsId)) continue;

        const riskToSev = (r?: string) => r === 'Critical' ? 'CRITICAL' : r === 'High' ? 'MAJOR' : 'MINOR';
        const riskToLvl = (r?: string) => r === 'Critical' ? 'L4' : r === 'High' ? 'L3' : r === 'Medium' ? 'L2' : 'L1';

        const obsData: any = {
          id: obsId,
          title: obs.comment || obs.questionText || '',
          observationText: obs.comment || obs.questionText || '',
          questionText: obs.questionText || undefined,
          sectionTitle: obs.sectionTitle || undefined,
          checklistName: obs.checklistName || taskData.title || undefined,
          sop: obs.sectionTitle || obs.checklistName || taskData.title || 'Internal Audit',
          severity: riskToSev(obs.risk),
          level: riskToLvl(obs.risk),
          mainKitchen: obs.responsibility?.length ? obs.responsibility[0] : (taskData.department?.split('›')[0]?.trim() || taskData.department || 'General'),
          area: obs.location || taskData.assignedLocations?.[0] || obs.pageTitle || 'Audit Area',
          hierarchy: resolvedUnitName,
          status: obs.closureStatus === 'Closed' ? 'RESOLVED' : 'OPEN',
          duration: '0d',
          followUpStatus: 'NOT DONE',
          followUpCount: 0,
          followUpDate: '',
          reportedBy: taskData.auditorName || 'Auditor',
          lastUpdate: completedDate,
          createdDate: completedDate,
          thumbnail: obs.images?.[0] || '',
          afterImage: obs.closureEvidence?.[0] || '',
          closureComments: obs.closureComments || null,
          isStarred: false,
          people: [...new Set(obs.responsibility || [])].map((r: string) => ({ name: r, impact: 0 })),
          assets: [],
          categories: obs.category ? [{ name: obs.category, impact: 0 }] : [],
          tracking: [
            { id: 'audit-reported', label: 'Reported via Audit', user: taskData.auditorName || 'Auditor', timestamp: completedDate, comments: `Score: ${obs.marksObtained ?? 0}/${obs.marksMax ?? 0}. Response: ${obs.selectedResponse || 'N/A'}` }
          ],
          unitId: resolvedUnitId,
          unitName: resolvedUnitName,
          regionalId: regionalEntity?.id || undefined,
          regionalName: regionalEntity?.name || undefined,
          departmentId: taskData.department?.split('›')[0]?.trim() || taskData.department || undefined,
          departmentName: taskData.department?.split('›')[0]?.trim() || taskData.department || undefined,
          allEvidence: (obs.images || []).filter((url: string) => url).map((url: string, i: number) => ({ id: `ev-${i}`, url, type: 'image' })),
          isAuditSourced: true,
          auditTaskId: task.id,
          auditObsQuestionId: obs.questionId || undefined,
          potentialMarkLoss: (obs.marksMax != null && obs.marksObtained != null) ? Math.max(0, (obs.marksMax || 0) - (obs.marksObtained || 0)) : undefined,
          maxMarks: obs.marksMax != null ? obs.marksMax : undefined,
          managementTag: obs.managementTag || undefined,
        };

        const jsonStr = JSON.stringify(obsData);
        try {
          await sql`INSERT INTO observations (id, data, created_at, updated_at) VALUES (${obsId}, ${jsonStr}::jsonb, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`;
          totalSynced++;
        } catch (e) {
          console.error(`[sync] Failed to insert audit obs ${obsId}:`, e);
        }
      }
    }
    console.log(`[sync] Audit observations sync complete: ${totalSynced} new observations persisted`);
  } catch (auditSyncErr) {
    console.error('[sync] Audit observations sync error (non-fatal):', auditSyncErr);
  }
}

export async function syncDevDataToDb() {
  if (syncCompleted) return;

  // Never overwrite production data with dev seed data
  if (process.env.NODE_ENV === 'production') {
    console.log('[sync] Production environment detected — skipping dev data sync');
    await cleanupProdDevSeedData();
    await runOneTimeObservationPurge();

    try {
      const MIGRATE_TASK_ID = 'sched-P-1773493501888-A-1773493535550-Mr.-Shreekant-Prasad-combined';
      const MIGRATE_VERSION = 'v3_fix_currentStep';
      const migrateCheck = await sql`SELECT data->>'_migrateVersion' as ver, (SELECT count(*) FROM jsonb_each(data->'answers') WHERE (value->>'selectedIndex') IS NOT NULL) as cnt FROM audit_reports WHERE id = ${MIGRATE_TASK_ID} AND type = 'draft'`;
      const answerCount = (Array.isArray(migrateCheck) && migrateCheck.length > 0) ? parseInt(migrateCheck[0].cnt || '0') : -1;
      const currentMigrateVer = (Array.isArray(migrateCheck) && migrateCheck.length > 0) ? migrateCheck[0].ver : null;
      if (answerCount <= 0 || currentMigrateVer !== MIGRATE_VERSION) {
        console.log('[sync] Running one-time Sawai Man Mahal audit recovery migration...');
        const taskRows = await sql`SELECT data FROM audit_tasks WHERE id = ${MIGRATE_TASK_ID}`;
        if (Array.isArray(taskRows) && taskRows.length > 0) {
          const task = taskRows[0].data;
          const checklistId = task.checklistId;
          const clRows = await sql`SELECT data FROM audit_checklists WHERE id = ${checklistId}`;
          if (Array.isArray(clRows) && clRows.length > 0) {
            const checklist = clRows[0].data;
            const responseMap: Record<string, any[]> = {};
            for (const page of (checklist.pages || [])) {
              for (const section of (page.sections || [])) {
                for (const q of (section.questions || [])) responseMap[q.id] = q.responses || [];
                for (const ss of (section.subSections || [])) {
                  for (const q of (ss.questions || [])) responseMap[q.id] = q.responses || [];
                }
              }
            }
            const answers: Record<string, any> = {};
            const comments: Record<string, string> = {};
            const locations = task.assignedLocations || [];
            let matched = 0;
            for (const tq of (task.questions || [])) {
              const responses = responseMap[tq.id];
              if (!responses) continue;
              matched++;
              let selectedIndex: number | null = null;
              let marks: number | null = null;
              if (tq.response) {
                const rl = tq.response.trim().toLowerCase();
                for (let i = 0; i < responses.length; i++) {
                  if ((responses[i].text || '').trim().toLowerCase() === rl) {
                    selectedIndex = i;
                    const s = responses[i].score;
                    marks = (s === '' || s == null) ? null : parseFloat(s);
                    break;
                  }
                }
              }
              for (const loc of locations) {
                const key = loc.replace(/ /g, '_') + '::' + tq.id;
                answers[key] = { selectedIndex, marks };
                if (tq.findings) {
                  comments[key] = {
                    entries: [{
                      id: `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      text: tq.findings,
                      images: [],
                      closureEvidence: [],
                      closureComments: '',
                      timestamp: new Date().toISOString(),
                      createdAtMs: Date.now(),
                      location: loc,
                    }]
                  };
                }
              }
            }
            const applicability: Record<string, boolean> = {};
            for (const page of (checklist.pages || [])) {
              for (const section of (page.sections || [])) {
                applicability[section.id] = true;
                for (const ss of (section.subSections || [])) applicability[ss.id] = true;
              }
            }
            const existingDraftRows = await sql`SELECT data FROM audit_reports WHERE id = ${MIGRATE_TASK_ID} AND type = 'draft'`;
            const existingDraft = (Array.isArray(existingDraftRows) && existingDraftRows.length > 0) ? existingDraftRows[0].data : {};
            const draft = {
              ...existingDraft,
              answers, comments, applicability,
              templateId: checklistId,
              checklistName: task.checklistName || existingDraft.checklistName || '',
              unitName: task.unitName || existingDraft.unitName || '',
              auditState: existingDraft.auditState || 'running',
              currentStep: 'checklist',
              savedAt: Date.now(),
              auditStartTime: existingDraft.auditStartTime || Date.now() - 36000000,
              totalPauseDuration: existingDraft.totalPauseDuration || 0,
              unitForm: existingDraft.unitForm || {},
              locationTags: existingDraft.locationTags || {},
              savedNotes: existingDraft.savedNotes || {},
              notesBestPractice: existingDraft.notesBestPractice || '',
              notesOpportunity: existingDraft.notesOpportunity || '',
              notesBPImages: existingDraft.notesBPImages || [],
              notesOFIImages: existingDraft.notesOFIImages || [],
              auditSignature: existingDraft.auditSignature || '',
              reviewerSignature: existingDraft.reviewerSignature || '',
              reviewerName: existingDraft.reviewerName || '',
              pageApplicability: existingDraft.pageApplicability || {},
              locationApplicability: existingDraft.locationApplicability || {},
              _migrateVersion: MIGRATE_VERSION,
            };
            const jsonData = JSON.stringify(draft);
            await sql`INSERT INTO audit_reports (id, type, data, updated_at)
                      VALUES (${MIGRATE_TASK_ID}, 'draft', ${jsonData}::jsonb, NOW())
                      ON CONFLICT (id, type) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
            await sql`UPDATE audit_tasks SET data = jsonb_set(data, '{status}', '"In Progress"'::jsonb), updated_at = NOW() WHERE id = ${MIGRATE_TASK_ID}`;
            console.log(`[sync] Migration complete: ${matched} questions, ${Object.keys(answers).length} answer entries`);
          }
        }
      } else if (answerCount > 0) {
        console.log(`[sync] Sawai Man Mahal audit already has ${answerCount} answers — migration not needed`);
      }
    } catch (migErr) {
      console.error('[sync] Audit recovery migration error (non-fatal):', migErr);
    }

    try {
      const obsIds = await sql`SELECT id FROM observations`;
      if (Array.isArray(obsIds) && obsIds.length > 0) {
        let cleaned = 0;
        for (const { id } of obsIds) {
          try {
            const rows = await sql`SELECT data FROM observations WHERE id = ${id}`;
            if (!rows || rows.length === 0) continue;
            const orig = JSON.stringify(rows[0].data);
            const data = { ...rows[0].data };
            let changed = false;
            const isB64 = (v: any, lim: number) => typeof v === 'string' && v.length > lim && v.startsWith('data:');
            const stripArr = (arr: any[]) => arr.map((item: any) => {
              if (!item) return item;
              if (typeof item === 'string' && isB64(item, 2000)) return '';
              if (typeof item === 'object') {
                const c = { ...item };
                ['url','image','data','src'].forEach(k => { if (isB64(c[k], 2000)) { c[k] = ''; changed = true; } });
                return c;
              }
              return item;
            });
            ['thumbnail','afterImage','beforeImage','image','signature'].forEach(k => {
              if (isB64(data[k], 150000)) { data[k] = ''; changed = true; }
            });
            if (Array.isArray(data.allEvidence)) { data.allEvidence = stripArr(data.allEvidence); }
            if (Array.isArray(data.evidence)) { data.evidence = stripArr(data.evidence); }
            if (Array.isArray(data.closureEvidence)) { data.closureEvidence = stripArr(data.closureEvidence); }
            else if (typeof data.closureEvidence === 'string' && isB64(data.closureEvidence, 2000)) { data.closureEvidence = ''; changed = true; }
            if (Array.isArray(data.tracking)) {
              data.tracking = data.tracking.map((t: any) => {
                if (!t) return t;
                const tc = { ...t };
                if (isB64(tc.image, 2000)) { tc.image = ''; changed = true; }
                if (Array.isArray(tc.allEvidence)) { tc.allEvidence = stripArr(tc.allEvidence); }
                return tc;
              });
            }
            if (changed) {
              const newStr = JSON.stringify(data);
              if (newStr.length < orig.length) {
                await sql`UPDATE observations SET data = ${newStr}::jsonb, updated_at = NOW() WHERE id = ${id}`;
                cleaned++;
              }
            }
          } catch {}
        }
        if (cleaned > 0) console.log(`[sync] Cleaned base64 from ${cleaned} observations in production`);
      }
    } catch (obsErr) {
      console.error('[sync] Observation cleanup error (non-fatal):', obsErr);
    }

    try {
      const RECOVERY_VERSION = 'img_recover_v1';
      const recoveryDone = await sql`SELECT 1 FROM sync_meta WHERE key = ${RECOVERY_VERSION}`;
      if (!Array.isArray(recoveryDone) || recoveryDone.length === 0) {
        console.log('[sync] Running one-time image recovery from audit reports...');
        await sql`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;

        const imageEntries: { text: string; location: string; image: string }[] = [];
        const reports = await sql`SELECT id, type, data FROM audit_reports 
          WHERE data->>'unitName' ILIKE '%jai mahal%' 
            AND LENGTH(data::text) > 10000`;

        for (const report of (reports || [])) {
          const reportData = report.data;
          if (!reportData) continue;
          const comments = reportData.comments;
          if (!comments || typeof comments !== 'object') continue;
          for (const [, commentData] of Object.entries(comments as Record<string, any>)) {
            const entries = (commentData as any)?.entries;
            if (!Array.isArray(entries)) continue;
            for (const entry of entries) {
              if (!entry || !entry.text) continue;
              const images = entry.images;
              if (!Array.isArray(images) || images.length === 0) continue;
              for (const imgItem of images) {
                const img = typeof imgItem === 'string' ? imgItem : imgItem?.url || imgItem?.data || '';
                if (!img || img.length < 100) continue;
                imageEntries.push({ text: entry.text.trim(), location: (entry.location || '').trim(), image: img });
              }
            }
          }
        }
        console.log(`[sync] Image recovery: found ${imageEntries.length} image entries from audit reports`);

        if (imageEntries.length > 0) {
          const obsRows = await sql`SELECT id, data FROM observations 
            WHERE data->>'unitName' ILIKE '%jai mahal%'
              AND (data->>'thumbnail' = '' OR data->>'thumbnail' IS NULL OR LENGTH(data->>'thumbnail') < 10)
              AND data->>'observationText' IS NOT NULL AND data->>'observationText' != ''`;

          let recovered = 0;
          for (const obs of (obsRows || [])) {
            const obsData = obs.data || {};
            const obsText = (obsData.observationText || '').trim();
            const obsArea = (obsData.area || '').trim().toLowerCase();
            if (!obsText) continue;
            const firstPart = obsText.split(';').map((p: string) => p.trim()).filter((p: string) => p.length > 3)[0] || obsText;

            let bestMatch: { text: string; location: string; image: string } | null = null;
            let bestScore = 0;
            for (const entry of imageEntries) {
              const entryLoc = entry.location.toLowerCase();
              const locationMatch = !entryLoc || !obsArea || obsArea.includes(entryLoc) || entryLoc.includes(obsArea);
              if (firstPart === entry.text && locationMatch) { bestMatch = entry; bestScore = 100; break; }
              if (firstPart === entry.text && bestScore < 90) { bestMatch = entry; bestScore = 90; }
              if (obsText.includes(entry.text) && locationMatch) { const s = 50 + entry.text.length; if (s > bestScore) { bestMatch = entry; bestScore = s; } }
              if (entry.text.length > 10 && firstPart.length > 10) {
                const prefix = entry.text.substring(0, Math.min(35, entry.text.length));
                if (firstPart.startsWith(prefix) && locationMatch && 40 + prefix.length > bestScore) { bestMatch = entry; bestScore = 40 + prefix.length; }
                if (firstPart.startsWith(prefix) && 30 + prefix.length > bestScore) { bestMatch = entry; bestScore = 30 + prefix.length; }
              }
            }

            if (bestMatch && bestScore >= 30) {
              try {
                const allImgs = imageEntries.filter(e => e.text === bestMatch!.text && e.location === bestMatch!.location).map(e => e.image);
                const updateData = JSON.stringify({ thumbnail: bestMatch.image, allEvidence: allImgs.length > 0 ? allImgs : [bestMatch.image] });
                await sql`UPDATE observations SET data = data || ${updateData}::jsonb, updated_at = NOW() WHERE id = ${obs.id}`;
                recovered++;
              } catch {}
            }
          }
          console.log(`[sync] Image recovery complete: ${recovered} observations restored`);
        }

        await sql`INSERT INTO sync_meta (key, value) VALUES (${RECOVERY_VERSION}, 'done') ON CONFLICT (key) DO NOTHING`;
      }
    } catch (recErr) {
      console.error('[sync] Image recovery error (non-fatal):', recErr);
    }

    await runAuditObsSync();

    // Backfill corporate_id + unit_id for raw_materials saved before corporate isolation was added
    try {
      const nullCorpMats = await sql`
        SELECT id, data->>'createdByEntityId' as entity_id
        FROM raw_materials
        WHERE corporate_id IS NULL AND data->>'createdByEntityId' IS NOT NULL
      `;
      if (Array.isArray(nullCorpMats) && nullCorpMats.length > 0) {
        const allEntities = await sql`SELECT id, data->>'type' as type, data->>'parentId' as parent_id FROM entities`;
        const entityMap = new Map((Array.isArray(allEntities) ? allEntities : []).map((e: any) => [e.id, e]));
        const findCorporate = (entityId: string): string | null => {
          let curr = entityMap.get(entityId);
          let depth = 0;
          while (curr && depth < 6) {
            if (curr.type === 'corporate') return curr.id;
            curr = entityMap.get(curr.parent_id);
            depth++;
          }
          return null;
        };
        let backfillCount = 0;
        for (const mat of nullCorpMats) {
          if (!mat.entity_id) continue;
          const corporateId = findCorporate(mat.entity_id);
          if (corporateId) {
            await sql`UPDATE raw_materials SET corporate_id = ${corporateId}, unit_id = COALESCE(unit_id, ${mat.entity_id}), updated_at = NOW() WHERE id = ${mat.id} AND corporate_id IS NULL`;
            backfillCount++;
          }
        }
        if (backfillCount > 0) console.log(`[sync] Backfilled corporate_id for ${backfillCount} raw materials`);
        else console.log('[sync] No raw materials needed corporate_id backfill');
      }
    } catch (err) {
      console.error('[sync] Error backfilling raw material corporate IDs (non-fatal):', err);
    }

    // Backfill brands from entity masterBrands into brands DB table
    try {
      await sql`CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY,
        corporate_id TEXT,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS brands_corporate_id_idx ON brands(corporate_id)`;
      const corpEntities = await sql`
        SELECT id, data FROM entities WHERE data->>'type' = 'corporate'
      `;
      if (Array.isArray(corpEntities)) {
        let totalBackfilled = 0;
        for (const corp of corpEntities) {
          const corpData = typeof corp.data === 'string' ? JSON.parse(corp.data) : corp.data;
          const masterBrands = corpData?.masterBrands;
          if (!Array.isArray(masterBrands) || masterBrands.length === 0) continue;
          for (const brand of masterBrands) {
            if (!brand?.id) continue;
            const existing = await sql`SELECT id FROM brands WHERE id = ${brand.id}`;
            if (Array.isArray(existing) && existing.length > 0) continue;
            const { id, corporateId, ...brandData } = brand;
            const jsonData = JSON.stringify(brandData);
            await sql`INSERT INTO brands (id, corporate_id, data, updated_at)
                      VALUES (${String(id)}, ${corp.id}, ${jsonData}::jsonb, NOW())
                      ON CONFLICT (id) DO NOTHING`;
            totalBackfilled++;
          }
        }
        if (totalBackfilled > 0) console.log(`[sync] Backfilled ${totalBackfilled} brands from entity masterBrands into brands table`);
        else console.log('[sync] No brands needed backfill from entity masterBrands');
      }
    } catch (err) {
      console.error('[sync] Error backfilling brands (non-fatal):', err);
    }

    await runWhatsappPromoBackfill();
    // One-shot quarantine for Default Corporate / Region / Unit recipe orphans.
    // Runs here in the production short-circuit branch so production databases
    // get the cleanup on the very next deploy/restart, regardless of sync state.
    await runDefaultOrphanCleanup();
    // One-shot share-link closure recovery; self-gated by sync_meta.
    // Runs in the production short-circuit branch too so production
    // databases get the recovery on the very next deploy/restart.
    await runShareLinkClosureRecovery();
    // One-shot recipes sub-recipe backfill; self-gated by sync_meta.
    await runRecipesSubRecipeBackfill();
    // One-shot ingredient aliasEntries backfill; self-gated by sync_meta.
    await runIngredientAliasesBackfill();

    syncCompleted = true;
    return;
  }

  // Advisory locks (pg_try_advisory_lock) are session-scoped in PostgreSQL.
  // Neon's connection pooling (PgBouncer) can leave stale locks on pooled sessions
  // that outlive the original request, permanently blocking future syncs.
  // In dev there is only ever one Next.js process, so the module-level syncCompleted
  // flag is sufficient deduplication — no advisory lock needed.
  try {
    await ensureAllTables();

      const currentVersion = await getSyncVersion();
      if (currentVersion === SYNC_VERSION) {
        console.log(`[sync] Already at version ${SYNC_VERSION}, skipping sync`);
        await runAuditObsSync();
        await runWhatsappPromoBackfill();
        // One-shot recipe owner cleanup; self-gated, safe on every startup.
        await runJaiMahalOwnerCleanup();
        // One-shot quarantine for Default Corporate / Region / Unit recipe orphans.
        await runDefaultOrphanCleanup();
        // One-shot share-link closure recovery; self-gated by sync_meta.
        await runShareLinkClosureRecovery();
        // One-shot recipes sub-recipe backfill; self-gated by sync_meta.
        await runRecipesSubRecipeBackfill();
        // One-shot ingredient aliasEntries backfill; self-gated by sync_meta.
        await runIngredientAliasesBackfill();
        syncCompleted = true;
        return;
      }

      console.log(`[sync] Syncing data (current: ${currentVersion || 'none'}, target: ${SYNC_VERSION})...`);

      for (const table of JSONB_TABLES) {
        try {
          const dataPath = path.join(process.cwd(), 'lib', 'sync-data', `${table}.json`);
          if (!fs.existsSync(dataPath)) continue;

          const rows: Array<{ id: string | number; data: any }> = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

          const fileIds = new Set(rows.map(r => String(r.id)));
          if (!MERGE_ONLY_TABLES.has(table)) {
            await deleteRemovedRows(table, fileIds);
          }

          if (rows.length === 0) continue;

          let inserted = 0;
          const BATCH = 25;

          for (let i = 0; i < rows.length; i += BATCH) {
            const batch = rows.slice(i, i + BATCH);
            await Promise.all(batch.map(async (row) => {
              const id = String(row.id);
              const jsonData = JSON.stringify(row.data);
              await upsertRow(table, id, jsonData);
              inserted++;
            }));
          }
          console.log(`[sync] ${table}: upserted ${inserted} rows`);
        } catch (err) {
          console.error(`[sync] Error syncing ${table}:`, err);
        }
      }

      try {
        const arPath = path.join(process.cwd(), 'lib', 'sync-data', 'audit_reports.json');
        if (fs.existsSync(arPath)) {
          const arRows: Array<{ id: string; type: string; data: any }> = JSON.parse(fs.readFileSync(arPath, 'utf-8'));
          await sql`CREATE TABLE IF NOT EXISTS audit_reports (id TEXT NOT NULL, type TEXT NOT NULL, data JSONB, PRIMARY KEY (id, type))`;

          if (!MERGE_ONLY_TABLES.has('audit_reports')) {
            const fileKeys = new Set(arRows.map(r => `${r.id}::${r.type}`));
            const dbRows = await sql`SELECT id, type FROM audit_reports`;
            if (Array.isArray(dbRows)) {
              const toDelete = dbRows.filter((r: any) => !fileKeys.has(`${r.id}::${r.type}`));
              for (const row of toDelete) {
                await sql`DELETE FROM audit_reports WHERE id = ${row.id} AND type = ${row.type}`;
              }
              if (toDelete.length > 0) {
                console.log(`[sync] audit_reports: deleted ${toDelete.length} stale rows`);
              }
            }
          }

          for (const row of arRows) {
            const jsonData = JSON.stringify(row.data);
            await sql`INSERT INTO audit_reports (id, type, data) VALUES (${row.id}, ${row.type}, ${jsonData}::jsonb)
                      ON CONFLICT (id, type) DO UPDATE SET data = ${jsonData}::jsonb`;
          }
          console.log(`[sync] audit_reports: upserted ${arRows.length} rows`);
        }
      } catch (err) {
        console.error('[sync] Error syncing audit_reports:', err);
      }

      try {
        const emailLogPath = path.join(process.cwd(), 'lib', 'sync-data', 'audit_email_log.json');
        if (fs.existsSync(emailLogPath)) {
          await sql`TRUNCATE audit_email_log RESTART IDENTITY`;
          const emailRows = JSON.parse(fs.readFileSync(emailLogPath, 'utf-8'));
          for (const row of emailRows) {
            await sql`INSERT INTO audit_email_log (auditor_name, unit_name, audit_names, locations, start_date, end_date, period_frequency, status) 
                      VALUES (${row.auditor_name}, ${row.unit_name}, ${row.audit_names}, ${row.locations || ''}, ${row.start_date || ''}, ${row.end_date || ''}, ${row.period_frequency || ''}, ${row.status || 'SENT'})`;
          }
          console.log(`[sync] audit_email_log: replaced with ${emailRows.length} rows`);
        }
      } catch (err) {
        console.error('[sync] Error syncing audit_email_log:', err);
      }

      try {
        const migrateTaskId = 'sched-P-1773493501888-A-1773493535550-Mr.-Shreekant-Prasad-combined';
        const taskCheck = await sql`SELECT data->>'status' as status FROM audit_tasks WHERE id = ${migrateTaskId}`;
        if (Array.isArray(taskCheck) && taskCheck.length > 0 && taskCheck[0].status === 'Completed') {
          await sql`UPDATE audit_tasks SET data = jsonb_set(data, '{status}', '"In Progress"'::jsonb), updated_at = NOW() WHERE id = ${migrateTaskId}`;
          console.log('[sync] Reset Sawai Man Mahal audit task to In Progress for draft recovery');
        }
      } catch (err) {
        console.error('[sync] Task status migration error (non-fatal):', err);
      }

      // Cleanup: delete all auto-generated static brands
      try {
        // Delete B-GEN- prefixed IDs (auto-generated demo brands)
        const bgenResult = await sql`DELETE FROM brands WHERE id LIKE 'B-GEN-%' RETURNING id`;
        const bgenCount = Array.isArray(bgenResult) ? bgenResult.length : 0;
        if (bgenCount > 0) console.log(`[sync] Deleted ${bgenCount} static B-GEN brands`);

        // Delete brands with auto-generated/demo descriptions
        const autoDescResult = await sql`DELETE FROM brands WHERE data->>'description' LIKE 'Automated supply chain identity%' RETURNING id`;
        const autoDescCount = Array.isArray(autoDescResult) ? autoDescResult.length : 0;
        if (autoDescCount > 0) console.log(`[sync] Deleted ${autoDescCount} auto-description brands`);

        // Delete legacy demo brand IDs from corp-acme entity
        const legacyIds = ['B-1024', 'B-1089'];
        const legacyResult = await sql`DELETE FROM brands WHERE id = ANY(${legacyIds}) RETURNING id`;
        const legacyCount = Array.isArray(legacyResult) ? legacyResult.length : 0;
        if (legacyCount > 0) console.log(`[sync] Deleted ${legacyCount} legacy demo brands`);
      } catch (err) {
        console.error('[sync] Error cleaning up static brands (non-fatal):', err);
      }

      // Backfill corporate_id + unit_id for raw_materials that have NULL corporate_id
      // but have createdByEntityId stored inside their data JSON
      try {
        const nullCorpMats = await sql`
          SELECT id, data->>'createdByEntityId' as entity_id
          FROM raw_materials
          WHERE corporate_id IS NULL AND data->>'createdByEntityId' IS NOT NULL
        `;
        if (Array.isArray(nullCorpMats) && nullCorpMats.length > 0) {
          const allEntities = await sql`SELECT id, data->>'type' as type, data->>'parentId' as parent_id FROM entities`;
          const entityMap = new Map((Array.isArray(allEntities) ? allEntities : []).map((e: any) => [e.id, e]));
          const findCorporate = (entityId: string): string | null => {
            let curr = entityMap.get(entityId);
            let depth = 0;
            while (curr && depth < 6) {
              if (curr.type === 'corporate') return curr.id;
              curr = entityMap.get(curr.parent_id);
              depth++;
            }
            return null;
          };
          let backfillCount = 0;
          for (const mat of nullCorpMats) {
            if (!mat.entity_id) continue;
            const corporateId = findCorporate(mat.entity_id);
            if (corporateId) {
              await sql`UPDATE raw_materials SET corporate_id = ${corporateId}, unit_id = COALESCE(unit_id, ${mat.entity_id}), updated_at = NOW() WHERE id = ${mat.id} AND corporate_id IS NULL`;
              backfillCount++;
            }
          }
          if (backfillCount > 0) console.log(`[sync] Backfilled corporate_id for ${backfillCount} raw materials`);
        }
      } catch (err) {
        console.error('[sync] Error backfilling raw material corporate IDs (non-fatal):', err);
      }

      await runWhatsappPromoBackfill();
      // One-shot recipe owner cleanup; self-gated, safe on every startup.
      await runJaiMahalOwnerCleanup();
      // One-shot quarantine for Default Corporate / Region / Unit recipe orphans.
      await runDefaultOrphanCleanup();
      // One-shot share-link closure recovery; self-gated by sync_meta.
      await runShareLinkClosureRecovery();
      // One-shot recipes sub-recipe backfill; self-gated by sync_meta.
      await runRecipesSubRecipeBackfill();
      // One-shot ingredient aliasEntries backfill; self-gated by sync_meta.
      await runIngredientAliasesBackfill();

      const versionSet = await setSyncVersion(SYNC_VERSION);
      if (versionSet) {
        syncCompleted = true;
        console.log('[sync] Data sync completed successfully');
      } else {
        console.error('[sync] Data sync completed but failed to persist sync version — will retry on next startup');
      }
  } catch (error) {
    console.error('[sync] Sync failed:', error);
  }
}
