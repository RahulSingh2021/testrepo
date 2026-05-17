'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Clock,
  Briefcase,
  IndianRupee,
  Building2,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import PublicSiteShell from '@/components/PublicSiteShell';
import {
  companyAvatar,
  getApplications,
  getCandidateProfile,
  getSavedJobIds,
  recordApplication,
  saveCandidateProfile,
  toggleSavedJob,
  type CandidateProfile,
} from '@/lib/jobsClient';
import { FALLBACK_JOBS } from '@/lib/jobsFallback';

interface JobDetail {
  id: string;
  title: string;
  company: string;
  location: string;
  city: string;
  experience: string;
  salary: string;
  employment: string;
  area: string;
  source: string;
  posted_on: string;
  promoted: boolean;
  apply_url: string;
  description: string;
  requirements: string[];
  skills: string[];
}

const formatPosted = (iso: string): string => {
  const ts = Date.parse(iso || '');
  if (Number.isNaN(ts)) return 'Recently posted';
  const h = (Date.now() - ts) / (1000 * 60 * 60);
  if (h < 24) return `${Math.max(1, Math.round(h))} hours ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  const w = Math.round(d / 7);
  return `${w} week${w === 1 ? '' : 's'} ago`;
};

export default function JobDetailPage({ jobId, initialPublicOnly = false }: { jobId: string; initialPublicOnly?: boolean }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [related, setRelated] = useState<JobDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [profile, setProfile] = useState<CandidateProfile>({
    name: '',
    email: '',
    phone: '',
    resumeUrl: '',
    headline: '',
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/jobs?public=1');
        const j = await r.json();
        if (cancelled) return;
        const apiItems = Array.isArray(j?.items) ? j.items : [];
        // If the database is empty (fresh install) the public list page
        // shows the curated seed openings — mirror that here so direct
        // links like /jobs/j1 still resolve to a real-looking record.
        const rows = apiItems.length > 0 ? apiItems : FALLBACK_JOBS;
        const items: JobDetail[] = rows.map((row: any) => ({
          id: String(row.id),
          title: String(row.title || ''),
          company: String(row.company || ''),
          location: String(row.location || ''),
          city: String(row.city || ''),
          experience: String(row.experience || ''),
          salary: String(row.salary || ''),
          employment: String(row.employment || 'Full-time'),
          area: String(row.area || 'Quality'),
          source: String(row.source || ''),
          posted_on: String(row.posted_on || ''),
          promoted: row.promoted === true,
          apply_url: String(row.apply_url || ''),
          description: String(row.description || ''),
          requirements: Array.isArray(row.requirements) ? row.requirements : [],
          skills: Array.isArray(row.skills) ? row.skills : [],
        }));
        const found = items.find((i) => i.id === jobId);
        if (!found) {
          setNotFound(true);
          setJob(null);
        } else {
          setJob(found);
          setRelated(
            items
              .filter((i) => i.id !== found.id && (i.area === found.area || i.city === found.city))
              .slice(0, 4),
          );
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    setSaved(getSavedJobIds().includes(jobId));
    setApplied(getApplications().some((a) => a.jobId === jobId));
    setProfile(getCandidateProfile());
  }, [jobId]);

  const avatar = useMemo(() => companyAvatar(job?.company || ''), [job?.company]);

  const handleSaveToggle = () => {
    const now = toggleSavedJob(jobId);
    setSaved(now);
  };

  const handleShare = async () => {
    if (typeof window === 'undefined' || !job) return;
    const url = window.location.href;
    const text = `${job.title} at ${job.company} — via HACCP Pro`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        setShareToast('Shared!');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareToast('Link copied to clipboard');
      } else {
        setShareToast(url);
      }
    } catch {
      try {
        await navigator.clipboard?.writeText(url);
        setShareToast('Link copied to clipboard');
      } catch {
        setShareToast('Could not share');
      }
    }
    setTimeout(() => setShareToast(null), 2200);
  };

  const handleApply = () => {
    if (!job) return;
    if (job.apply_url) {
      recordApplication({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        appliedAt: Date.now(),
        applyUrl: job.apply_url,
      });
      setApplied(true);
      window.open(job.apply_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleProfileSave = () => {
    saveCandidateProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  if (loading) {
    return (
      <PublicSiteShell activeSection="jobs" initialPublicOnly={initialPublicOnly}>
        <main className="bg-slate-50 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-emerald-500 mx-auto mb-3 animate-spin" />
            <p className="text-sm font-bold text-slate-500">Loading job…</p>
          </div>
        </main>
      </PublicSiteShell>
    );
  }

  if (notFound || !job) {
    return (
      <PublicSiteShell activeSection="jobs" initialPublicOnly={initialPublicOnly}>
        <main className="bg-slate-50 min-h-screen py-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Job not found</h1>
            <p className="text-sm text-slate-500 mb-6">
              This opening may have been removed or is no longer accepting applications.
            </p>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold"
            >
              <ChevronLeft className="w-4 h-4" /> Back to jobs
            </Link>
          </div>
        </main>
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell activeSection="jobs" initialPublicOnly={initialPublicOnly}>
      <main className="bg-slate-50 min-h-screen pb-16">
        {/* Top bar with back link */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              All jobs
            </Link>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
          {/* Main column */}
          <article className="space-y-5">
            {/* Header card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-wrap items-start gap-5">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl ${avatar.bg} ${avatar.fg} flex items-center justify-center text-2xl sm:text-3xl font-black`}
                >
                  {avatar.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {job.promoted && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-wider">
                        Promoted
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                      {job.area}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Posted {formatPosted(job.posted_on)}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                    {job.title}
                  </h1>
                  <p className="mt-1 text-base font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-400" /> {job.company}
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <DetailMeta icon={<MapPin className="w-4 h-4" />} label="Location" value={job.location || '—'} />
                <DetailMeta icon={<Clock className="w-4 h-4" />} label="Experience" value={job.experience || '—'} />
                <DetailMeta
                  icon={<IndianRupee className="w-4 h-4" />}
                  label="Salary"
                  value={job.salary || '—'}
                  emphasize
                />
                <DetailMeta
                  icon={<Briefcase className="w-4 h-4" />}
                  label="Employment"
                  value={job.employment || '—'}
                />
              </dl>

              <div className="mt-6 flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleApply}
                  disabled={!job.apply_url}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-extrabold transition-colors"
                >
                  {applied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Applied · Apply again
                    </>
                  ) : (
                    <>
                      Apply now <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveToggle}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                    saved
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  {saved ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                {shareToast && (
                  <span className="text-xs font-bold text-emerald-600">{shareToast}</span>
                )}
              </div>
            </div>

            {/* About this role */}
            {job.description ? (
              <Section title="About this role">
                <pre className="font-sans text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {job.description}
                </pre>
              </Section>
            ) : (
              <Section title="About this role">
                <p className="text-sm text-slate-500 italic">
                  The recruiter hasn't published a long-form description yet. Click "Apply now" to
                  see the full posting on {job.source || 'the source site'}.
                </p>
              </Section>
            )}

            {/* Requirements */}
            {job.requirements.length > 0 && (
              <Section title="What you'll bring">
                <ul className="space-y-2.5">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Skills */}
            {job.skills.length > 0 && (
              <Section title="Skills">
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </article>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-6 self-start">
            {/* Candidate profile */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="text-left">
                  <h3 className="text-sm font-extrabold text-slate-900">Your profile</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {profile.name ? 'Saved on this device' : 'Speed up future applications'}
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-600">
                  {profileOpen ? 'Hide' : 'Edit'}
                </span>
              </button>
              {profileOpen && (
                <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                  <ProfileField
                    label="Name"
                    value={profile.name}
                    onChange={(v) => setProfile({ ...profile, name: v })}
                  />
                  <ProfileField
                    label="Email"
                    type="email"
                    value={profile.email}
                    onChange={(v) => setProfile({ ...profile, email: v })}
                  />
                  <ProfileField
                    label="Phone"
                    value={profile.phone}
                    onChange={(v) => setProfile({ ...profile, phone: v })}
                  />
                  <ProfileField
                    label="Headline"
                    value={profile.headline}
                    placeholder="Senior QA Manager · 8 yrs · HACCP, FSSC 22000"
                    onChange={(v) => setProfile({ ...profile, headline: v })}
                  />
                  <ProfileField
                    label="Resume URL"
                    type="url"
                    placeholder="https://drive.google.com/your-resume"
                    value={profile.resumeUrl}
                    onChange={(v) => setProfile({ ...profile, resumeUrl: v })}
                    hint="Paste a public link (Google Drive, Dropbox, your portfolio site)."
                  />
                  <button
                    onClick={handleProfileSave}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-extrabold"
                  >
                    {profileSaved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                      </>
                    ) : (
                      'Save profile'
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Stored only in your browser. We don't have an account system yet, so this never
                    leaves this device.
                  </p>
                </div>
              )}
            </div>

            {/* Source pill */}
            {job.source && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-[10px] font-black tracking-[0.18em] text-slate-400 mb-2">
                  SOURCE
                </div>
                <div className="text-sm font-bold text-slate-900">via {job.source}</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Application takes you to the recruiter's hosted page.
                </p>
              </div>
            )}

            {/* Related jobs */}
            {related.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3 inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500" /> Similar openings
                </h3>
                <ul className="space-y-3">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/jobs/${r.id}`}
                        className="block group rounded-lg p-3 -m-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 line-clamp-1">
                          {r.title}
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {r.company} · {r.city || r.location}
                        </div>
                        {r.salary && (
                          <div className="text-xs font-bold text-emerald-700 mt-1">{r.salary}</div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </main>
    </PublicSiteShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
      <h2 className="text-sm font-black tracking-[0.18em] text-slate-500 uppercase mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DetailMeta({
  icon,
  label,
  value,
  emphasize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[0.18em] text-slate-400">
        {label.toUpperCase()}
      </div>
      <div
        className={`mt-1 inline-flex items-center gap-1.5 text-sm font-bold ${
          emphasize ? 'text-emerald-700' : 'text-slate-800'
        }`}
      >
        <span className="text-slate-400">{icon}</span>
        <span>{value}</span>
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black tracking-[0.18em] text-slate-500 uppercase mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
      {hint && <span className="block mt-1 text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}
