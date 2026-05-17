import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Public job-submission endpoint used by the "Post a Job" form on
// /jobs. Anyone can POST here without an admin session; submissions
// are forced into the `pending` lifecycle state so they never appear
// on the public board until an admin explicitly approves them via
// AcademyAdmin → Jobs.
//
// Why a separate route instead of branching the main /api/jobs POST?
// 1. The main route requires `requireAdminSession`. Carving out an
//    auth-bypass branch there increases the surface area for an
//    accidental privilege escalation.
// 2. Submissions need stricter sanitisation (no `promoted: true`,
//    no `status: published`, no overriding admin-set fields) and
//    a different rate-limit posture in the future.

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS jobs_posts (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const FUNCTIONAL_AREAS = ['Quality', 'Production', 'Regulatory', 'R&D'] as const;
const EMPLOYMENTS = ['Full-time', 'Contract', 'Remote'] as const;

const clamp = (s: any, max: number) =>
  String(s || '').trim().slice(0, max);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Honeypot field — bots fill every input they see; humans never
    // touch the hidden one. If it's populated we silently 200 so the
    // bot doesn't retry, but we never persist anything.
    if (body.website && String(body.website).trim()) {
      return NextResponse.json({ success: true, pending: true });
    }

    const title = clamp(body.title, 200);
    const company = clamp(body.company, 200);
    const submitterEmail = clamp(body.submitter_email, 200);
    const applyUrl = clamp(body.apply_url, 500);

    if (!title || !company) {
      return NextResponse.json(
        { error: 'Title and Company are required' },
        { status: 400 },
      );
    }
    if (!submitterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
      return NextResponse.json(
        { error: 'A valid contact email is required' },
        { status: 400 },
      );
    }
    // Apply URL is optional but if present must be a real http(s) URL —
    // never a javascript: or data: payload.
    if (applyUrl && !/^https?:\/\//i.test(applyUrl)) {
      return NextResponse.json(
        { error: 'Application link must start with http:// or https://' },
        { status: 400 },
      );
    }

    const employment = (EMPLOYMENTS as readonly string[]).includes(body.employment)
      ? body.employment
      : 'Full-time';
    const area = (FUNCTIONAL_AREAS as readonly string[]).includes(body.area)
      ? body.area
      : 'Quality';

    const location = clamp(body.location, 200);
    const data = {
      title,
      company,
      location,
      city: location.split(/[,\-(]/)[0].trim().slice(0, 80),
      experience: clamp(body.experience, 80),
      salary: clamp(body.salary, 80),
      employment,
      area,
      source: clamp(body.source || body.company, 80),
      apply_url: applyUrl,
      posted_on: new Date().toISOString(),
      promoted: false, // never auto-promote a public submission
      status: 'pending' as const,
      description: clamp(body.description, 8000),
      requirements: [],
      skills: [],
      submitter_name: clamp(body.submitter_name, 120),
      submitter_email: submitterEmail,
      submitter_phone: clamp(body.submitter_phone, 40),
      submitted_at: new Date().toISOString(),
    };

    await ensureTable();
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const jsonData = JSON.stringify(data);
    await sql`INSERT INTO jobs_posts (id, data, updated_at)
              VALUES (${id}, ${jsonData}::jsonb, NOW())`;

    return NextResponse.json({ success: true, pending: true, id });
  } catch (error) {
    console.error('Jobs submit: failed:', error);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
