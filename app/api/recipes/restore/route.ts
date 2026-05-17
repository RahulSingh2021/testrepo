import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS recipes_backup (
      backup_id SERIAL PRIMARY KEY,
      backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
      owner_id TEXT,
      recipe_id BIGINT,
      data JSONB,
      reason TEXT DEFAULT 'pre-sync'
    )`;
    const snapshots = await sql`
      SELECT DISTINCT backup_timestamp, owner_id, reason, COUNT(*) as recipe_count
      FROM recipes_backup
      GROUP BY backup_timestamp, owner_id, reason
      ORDER BY backup_timestamp DESC
      LIMIT 20
    `;
    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('Failed to list backups:', error);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { backup_timestamp, owner_id } = await request.json();
    if (!backup_timestamp || !owner_id) {
      return NextResponse.json({ error: 'backup_timestamp and owner_id required' }, { status: 400 });
    }
    const backupRows = await sql`
      SELECT recipe_id, data, owner_id FROM recipes_backup
      WHERE backup_timestamp = ${backup_timestamp} AND owner_id = ${owner_id}
    `;
    if (backupRows.length === 0) {
      return NextResponse.json({ error: 'No backup found for that timestamp/owner' }, { status: 404 });
    }
    let restored = 0;
    for (const r of backupRows) {
      const jsonData = JSON.stringify(r.data);
      await sql`INSERT INTO recipes (id, data, owner_id, updated_at)
                VALUES (${r.recipe_id}, ${jsonData}::jsonb, ${r.owner_id}, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      restored++;
    }
    return NextResponse.json({ success: true, restored });
  } catch (error) {
    console.error('Failed to restore recipes:', error);
    return NextResponse.json({ error: 'Failed to restore' }, { status: 500 });
  }
}
