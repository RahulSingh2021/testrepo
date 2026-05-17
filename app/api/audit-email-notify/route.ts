import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS audit_email_log (
      id SERIAL PRIMARY KEY,
      auditor_name TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      audit_names TEXT NOT NULL,
      locations TEXT,
      start_date TEXT,
      end_date TEXT,
      period_frequency TEXT,
      status TEXT DEFAULT 'QUEUED',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const body = await request.json();
    const { unitName, periodFrequency, periodStart, periodEnd, auditors } = body;

    if (!auditors || !Array.isArray(auditors) || auditors.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No auditors to notify' });
    }

    if (!unitName || !periodFrequency) {
      return NextResponse.json({ success: false, error: 'unitName and periodFrequency are required' }, { status: 400 });
    }

    for (const auditor of auditors) {
      if (!auditor.name) continue;
      const auditNames = Array.isArray(auditor.audits) ? auditor.audits.join(', ') : '';
      const locations = Array.isArray(auditor.locations) ? auditor.locations.join(', ') : '';
      await sql`INSERT INTO audit_email_log (auditor_name, unit_name, audit_names, locations, start_date, end_date, period_frequency, status)
        VALUES (${auditor.name}, ${unitName}, ${auditNames || 'Unspecified'}, ${locations || ''}, ${auditor.startDate || periodStart || ''}, ${auditor.endDate || periodEnd || ''}, ${periodFrequency}, 'SENT')`;
    }

    return NextResponse.json({ 
      success: true, 
      sent: auditors.length,
      message: `Email intimations logged for ${auditors.length} auditor(s)` 
    });
  } catch (error) {
    console.error('Failed to log audit email notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to process email notifications' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS audit_email_log (
      id SERIAL PRIMARY KEY,
      auditor_name TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      audit_names TEXT NOT NULL,
      locations TEXT,
      start_date TEXT,
      end_date TEXT,
      period_frequency TEXT,
      status TEXT DEFAULT 'QUEUED',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const rows = await sql`SELECT * FROM audit_email_log ORDER BY created_at DESC LIMIT 50`;
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error('Failed to fetch email log:', error);
    return NextResponse.json([], { status: 200 });
  }
}
