'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Briefcase,
  IndianRupee,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  TrendingUp,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  CheckCircle2,
  User,
  Building2,
  Filter as FilterIcon,
} from 'lucide-react';
import { useLandingT } from '@/lib/landingI18n';
import PublicSiteShell from '@/components/PublicSiteShell';
import {
  companyAvatar,
  getApplications,
  getCandidateProfile,
  getSavedJobIds,
  highlightSegments,
  parseSalaryRange,
  recordApplication,
  saveCandidateProfile,
  toggleSavedJob,
  type CandidateProfile,
} from '@/lib/jobsClient';
import { FALLBACK_JOBS as RAW_FALLBACK } from '@/lib/jobsFallback';
import JobPostForm from '@/components/JobPostForm';

type FunctionalArea = 'All' | 'Quality' | 'Production' | 'Regulatory' | 'R&D';
type JobType = 'All' | 'Full-time' | 'Contract' | 'Remote';
type ExperienceBucket = 'All' | 'Entry' | 'Mid' | 'Senior' | 'Lead';
type Tab = 'all' | 'saved' | 'applied';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  city: string;
  experience: string;
  salary: string;
  employment: 'Full-time' | 'Contract' | 'Remote';
  area: Exclude<FunctionalArea, 'All'>;
  source: string;
  postedHoursAgo: number;
  postedOnIso: string;
  promoted?: boolean;
  applyUrl: string;
  description: string;
  requirements: string[];
  skills: string[];
}

// Seed openings shown when the admin hasn't posted any jobs yet, so
// the page never renders empty on a fresh install. Once /api/jobs
// returns at least one row, the live feed wins and these are
// suppressed. The raw data lives in lib/jobsFallback.ts so the
// detail page can resolve the same IDs.
const FALLBACK_JOBS: Job[] = RAW_FALLBACK.map((j) => ({
  id: j.id,
  title: j.title,
  company: j.company,
  location: j.location,
  city: j.city,
  experience: j.experience,
  salary: j.salary,
  employment: j.employment,
  area: j.area,
  source: j.source,
  postedHoursAgo: hoursSince(j.posted_on),
  postedOnIso: j.posted_on,
  promoted: j.promoted,
  applyUrl: j.apply_url,
  description: j.description,
  requirements: j.requirements,
  skills: j.skills,
}));


const PAGE_SIZE = 5;

const formatPosted = (h: number): string => {
  if (h < 24) return `${Math.max(1, Math.round(h))}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  return `${w}w`;
};

const FUNCTIONAL_AREAS: FunctionalArea[] = ['All', 'Quality', 'Production', 'Regulatory', 'R&D'];
const JOB_TYPES: JobType[] = ['All', 'Full-time', 'Contract', 'Remote'];
const EXPERIENCE_BUCKETS: { key: ExperienceBucket; label: string; min: number; max: number }[] = [
  { key: 'All', label: 'Any', min: 0, max: 100 },
  { key: 'Entry', label: '0–2 yrs', min: 0, max: 2 },
  { key: 'Mid', label: '3–5 yrs', min: 3, max: 5 },
  { key: 'Senior', label: '6–9 yrs', min: 6, max: 9 },
  { key: 'Lead', label: '10+ yrs', min: 10, max: 100 },
];

function hoursSince(iso: string): number {
  const ts = Date.parse(iso || '');
  if (Number.isNaN(ts)) return 9999;
  return Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
}

// Pull a numeric "lower bound years" out of an experience string so we
// can bucket "8-12 years" into the Senior/Lead filter without needing
// the admin to pick from a dropdown.
const minExperienceYears = (s: string): number => {
  const m = (s || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

export default function JobsPage({ initialPublicOnly = false }: { initialPublicOnly?: boolean } = {}) {
  const { t } = useLandingT();
  const [search, setSearch] = useState('');
  const [activeArea, setActiveArea] = useState<FunctionalArea>('All');
  const [activeType, setActiveType] = useState<JobType>('All');
  const [activeCity, setActiveCity] = useState<string>('All');
  const [activeExp, setActiveExp] = useState<ExperienceBucket>('All');
  const [minSalaryLpa, setMinSalaryLpa] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'recent' | 'salary'>('recent');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [liveJobs, setLiveJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<CandidateProfile>({
    name: '', email: '', phone: '', resumeUrl: '', headline: '',
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [shareToast, setShareToast] = useState<{ id: string; msg: string } | null>(null);
  const [postFormOpen, setPostFormOpen] = useState(false);

  // Pull admin-posted jobs from the API. If the call fails or no rows
  // exist yet, fall back to the curated seed list so the page never
  // looks broken on a fresh install.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/jobs?public=1');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        const items: Job[] = (Array.isArray(j?.items) ? j.items : []).map((row: any) => ({
          id: String(row.id),
          title: String(row.title || ''),
          company: String(row.company || ''),
          location: String(row.location || ''),
          city: String(row.city || row.location || '').split(/[,\-(]/)[0].trim(),
          experience: String(row.experience || ''),
          salary: String(row.salary || ''),
          employment:
            row.employment === 'Contract' || row.employment === 'Remote'
              ? row.employment
              : 'Full-time',
          area: ['Quality', 'Production', 'Regulatory', 'R&D'].includes(row.area)
            ? row.area
            : 'Quality',
          source: String(row.source || ''),
          postedHoursAgo: hoursSince(String(row.posted_on || '')),
          postedOnIso: String(row.posted_on || ''),
          promoted: row.promoted === true,
          applyUrl: String(row.apply_url || ''),
          description: String(row.description || ''),
          requirements: Array.isArray(row.requirements) ? row.requirements : [],
          skills: Array.isArray(row.skills) ? row.skills : [],
        }));
        setLiveJobs(items);
      } catch {
        if (!cancelled) setLiveJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate localStorage state and listen for cross-component updates
  // (e.g. the detail page saving a job — we want the count badge here
  // to update without a full refresh).
  useEffect(() => {
    const refresh = () => {
      setSavedIds(getSavedJobIds());
      setAppliedIds(getApplications().map((a) => a.jobId));
      setProfile(getCandidateProfile());
    };
    refresh();
    window.addEventListener('haccppro:jobs:saved-changed', refresh);
    window.addEventListener('haccppro:jobs:apps-changed', refresh);
    window.addEventListener('haccppro:jobs:profile-changed', refresh);
    return () => {
      window.removeEventListener('haccppro:jobs:saved-changed', refresh);
      window.removeEventListener('haccppro:jobs:apps-changed', refresh);
      window.removeEventListener('haccppro:jobs:profile-changed', refresh);
    };
  }, []);

  const sourceJobs = liveJobs && liveJobs.length > 0 ? liveJobs : FALLBACK_JOBS;

  // City list is derived from whatever's in the data so the dropdown
  // never goes stale — admins don't have to maintain a separate list.
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const j of sourceJobs) {
      if (j.city) set.add(j.city);
    }
    return ['All', ...Array.from(set).sort()];
  }, [sourceJobs]);

  // Highest salary in the dataset rounded up to the nearest 5 LPA, so
  // the slider auto-fits regardless of what the admin posts.
  const maxSalaryLpa = useMemo(() => {
    let max = 30;
    for (const j of sourceJobs) {
      const r = parseSalaryRange(j.salary);
      if (r && r.max > max) max = r.max;
    }
    return Math.max(30, Math.ceil(max / 5) * 5);
  }, [sourceJobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const expBucket =
      EXPERIENCE_BUCKETS.find((e) => e.key === activeExp) || EXPERIENCE_BUCKETS[0];

    let out = sourceJobs.filter((j) => {
      if (tab === 'saved' && !savedIds.includes(j.id)) return false;
      if (tab === 'applied' && !appliedIds.includes(j.id)) return false;
      if (activeArea !== 'All' && j.area !== activeArea) return false;
      if (activeType !== 'All' && j.employment !== activeType) return false;
      if (activeCity !== 'All' && j.city !== activeCity) return false;
      if (activeExp !== 'All') {
        const yrs = minExperienceYears(j.experience);
        if (yrs < expBucket.min || yrs > expBucket.max) return false;
      }
      if (minSalaryLpa > 0) {
        const r = parseSalaryRange(j.salary);
        if (!r || r.max < minSalaryLpa) return false;
      }
      if (!q) return true;
      const hay =
        j.title +
        ' ' +
        j.company +
        ' ' +
        j.area +
        ' ' +
        j.location +
        ' ' +
        j.skills.join(' ');
      return hay.toLowerCase().includes(q);
    });

    if (sortBy === 'recent') {
      out = [...out].sort((a, b) => a.postedHoursAgo - b.postedHoursAgo);
    } else {
      const lo = (s: string) => parseSalaryRange(s)?.min || 0;
      out = [...out].sort((a, b) => lo(b.salary) - lo(a.salary));
    }

    // Promoted listings always rise to the top of whatever sort the
    // user picked — that's the value we promise advertisers.
    out = [...out].sort((a, b) => Number(!!b.promoted) - Number(!!a.promoted));
    return out;
  }, [
    search,
    activeArea,
    activeType,
    activeCity,
    activeExp,
    minSalaryLpa,
    sortBy,
    sourceJobs,
    tab,
    savedIds,
    appliedIds,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const clearAll = () => {
    setActiveArea('All');
    setActiveType('All');
    setActiveCity('All');
    setActiveExp('All');
    setMinSalaryLpa(0);
    setSearch('');
    resetPage();
  };

  const hasActiveFilters =
    activeArea !== 'All' ||
    activeType !== 'All' ||
    activeCity !== 'All' ||
    activeExp !== 'All' ||
    minSalaryLpa > 0 ||
    !!search.trim();

  const handleSave = (jobId: string) => {
    toggleSavedJob(jobId);
    setSavedIds(getSavedJobIds());
  };

  const handleApply = (job: Job) => {
    if (!job.applyUrl) return;
    recordApplication({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      appliedAt: Date.now(),
      applyUrl: job.applyUrl,
    });
    setAppliedIds(getApplications().map((a) => a.jobId));
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async (job: Job) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/jobs/${job.id}`;
    const text = `${job.title} at ${job.company} — via HACCP Pro`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        setShareToast({ id: job.id, msg: 'Shared!' });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareToast({ id: job.id, msg: 'Link copied' });
      }
    } catch {
      try {
        await navigator.clipboard?.writeText(url);
        setShareToast({ id: job.id, msg: 'Link copied' });
      } catch {
        setShareToast({ id: job.id, msg: 'Could not copy' });
      }
    }
    setTimeout(() => setShareToast(null), 1800);
  };

  const handleProfileSave = () => {
    saveCandidateProfile(profile);
    setProfileSavedToast(true);
    setTimeout(() => setProfileSavedToast(false), 2000);
  };

  // Headline stats for the hero — pulled live from data so they stay
  // honest as the admin posts more openings.
  const stats = useMemo(() => {
    const companies = new Set(sourceJobs.map((j) => j.company)).size;
    const cityCount = new Set(sourceJobs.map((j) => j.city).filter(Boolean)).size;
    const fresh = sourceJobs.filter((j) => j.postedHoursAgo < 48).length;
    return { total: sourceJobs.length, companies, cities: cityCount, fresh };
  }, [sourceJobs]);

  return (
    <PublicSiteShell activeSection="jobs" initialPublicOnly={initialPublicOnly}>
      <main className="bg-slate-50 min-h-screen pb-16">
        {/* Hero ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white">
          <div className="absolute inset-0 opacity-20" aria-hidden>
            <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-emerald-300 blur-3xl" />
            <div className="absolute -bottom-32 -right-10 w-[28rem] h-[28rem] rounded-full bg-teal-300 blur-3xl" />
          </div>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-[10px] font-black tracking-[0.18em] uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5" /> India's Food Safety Job Board
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-3">
              {t.navJobs}
              <span className="text-emerald-200"> that move careers forward.</span>
            </h1>
            <p className="text-base sm:text-lg text-emerald-50/90 max-w-2xl mb-7">
              Curated openings in Quality, Production, Regulatory, and R&D from India's leading FBOs
              and consultancies.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPage();
              }}
              className="flex flex-col sm:flex-row gap-3 max-w-3xl"
            >
              <div className="flex-1 relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetPage();
                  }}
                  placeholder="Search by title, skill, company, or city…"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-extrabold shadow-lg transition-colors"
              >
                Search Jobs
              </button>
            </form>

            {/* Stat pills */}
            <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Open roles" value={stats.total} />
              <Stat label="Companies hiring" value={stats.companies} />
              <Stat label="Cities" value={stats.cities} />
              <Stat label="Posted this week" value={stats.fresh} accent />
            </div>
          </div>
        </section>

        {/* Body ──────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
            {/* Filters sidebar */}
            <aside className="space-y-4">
              {/* Profile widget */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold">
                    {profile.name ? profile.name.trim().charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-slate-900 truncate">
                      {profile.name || 'Your profile'}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                      {profile.headline || (profile.email ? profile.email : 'Tap to set up')}
                    </div>
                  </div>
                </button>
                {profileOpen && (
                  <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                    <SmallField
                      label="Name"
                      value={profile.name}
                      onChange={(v) => setProfile({ ...profile, name: v })}
                    />
                    <SmallField
                      label="Email"
                      type="email"
                      value={profile.email}
                      onChange={(v) => setProfile({ ...profile, email: v })}
                    />
                    <SmallField
                      label="Phone"
                      value={profile.phone}
                      onChange={(v) => setProfile({ ...profile, phone: v })}
                    />
                    <SmallField
                      label="Headline"
                      value={profile.headline}
                      placeholder="Senior QA · 8 yrs · HACCP"
                      onChange={(v) => setProfile({ ...profile, headline: v })}
                    />
                    <SmallField
                      label="Resume URL"
                      type="url"
                      placeholder="https://drive.google.com/…"
                      value={profile.resumeUrl}
                      onChange={(v) => setProfile({ ...profile, resumeUrl: v })}
                    />
                    <button
                      onClick={handleProfileSave}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-extrabold"
                    >
                      {profileSavedToast ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                        </>
                      ) : (
                        'Save profile'
                      )}
                    </button>
                    <p className="text-[11px] text-slate-400">
                      Stored in your browser only.
                    </p>
                  </div>
                )}
              </div>

              {/* Filters card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-black tracking-[0.2em] text-slate-900 inline-flex items-center gap-1.5">
                    <FilterIcon className="w-3.5 h-3.5" /> FILTERS
                  </h2>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAll}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      CLEAR ALL
                    </button>
                  )}
                </div>

                <FilterGroup
                  label="FUNCTIONAL AREA"
                  options={FUNCTIONAL_AREAS}
                  value={activeArea}
                  onChange={(v) => {
                    setActiveArea(v as FunctionalArea);
                    resetPage();
                  }}
                  tone="emerald"
                />

                <Divider />

                <FilterGroup
                  label="JOB TYPE"
                  options={JOB_TYPES}
                  value={activeType}
                  onChange={(v) => {
                    setActiveType(v as JobType);
                    resetPage();
                  }}
                  tone="indigo"
                />

                <Divider />

                <div>
                  <h3 className="text-[10px] font-black tracking-[0.18em] text-slate-400 mb-2">
                    CITY
                  </h3>
                  <select
                    value={activeCity}
                    onChange={(e) => {
                      setActiveCity(e.target.value);
                      resetPage();
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <Divider />

                <div>
                  <h3 className="text-[10px] font-black tracking-[0.18em] text-slate-400 mb-2">
                    EXPERIENCE LEVEL
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPERIENCE_BUCKETS.map((b) => (
                      <button
                        key={b.key}
                        onClick={() => {
                          setActiveExp(b.key);
                          resetPage();
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                          activeExp === b.key
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Divider />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black tracking-[0.18em] text-slate-400">
                      MIN SALARY
                    </h3>
                    <span className="text-xs font-extrabold text-emerald-700">
                      {minSalaryLpa === 0 ? 'Any' : `≥ ₹${minSalaryLpa} LPA`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxSalaryLpa}
                    step={1}
                    value={minSalaryLpa}
                    onChange={(e) => {
                      setMinSalaryLpa(parseInt(e.target.value, 10));
                      resetPage();
                    }}
                    className="w-full accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                    <span>₹0</span>
                    <span>₹{maxSalaryLpa} LPA</span>
                  </div>
                </div>
              </div>

              {/* Post a Job CTA */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white shadow-sm">
                <Sparkles className="w-5 h-5 mb-3 opacity-90" />
                <h3 className="text-base font-extrabold mb-1">Post a Job</h3>
                <p className="text-xs text-emerald-50 mb-4 leading-relaxed">
                  Looking for food safety talent? Reach 10k+ professionals.
                </p>
                <button
                  type="button"
                  onClick={() => setPostFormOpen(true)}
                  className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-white text-emerald-700 text-xs font-extrabold hover:bg-emerald-50 transition-colors"
                >
                  Get Started
                </button>
              </div>
            </aside>

            {/* Job list */}
            <div>
              {/* Tab bar + sort */}
              <div className="bg-white border border-slate-200 rounded-2xl p-2 mb-5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                  <TabPill active={tab === 'all'} onClick={() => { setTab('all'); resetPage(); }} count={sourceJobs.length}>
                    All jobs
                  </TabPill>
                  <TabPill active={tab === 'saved'} onClick={() => { setTab('saved'); resetPage(); }} count={savedIds.length}>
                    Saved
                  </TabPill>
                  <TabPill active={tab === 'applied'} onClick={() => { setTab('applied'); resetPage(); }} count={appliedIds.length}>
                    Applied
                  </TabPill>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 pr-2">
                  SORT:
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'recent' | 'salary')}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="salary">Highest Salary</option>
                  </select>
                </label>
              </div>

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  {search && (
                    <Chip onRemove={() => setSearch('')}>Search: "{search}"</Chip>
                  )}
                  {activeArea !== 'All' && (
                    <Chip onRemove={() => setActiveArea('All')}>Area: {activeArea}</Chip>
                  )}
                  {activeType !== 'All' && (
                    <Chip onRemove={() => setActiveType('All')}>Type: {activeType}</Chip>
                  )}
                  {activeCity !== 'All' && (
                    <Chip onRemove={() => setActiveCity('All')}>City: {activeCity}</Chip>
                  )}
                  {activeExp !== 'All' && (
                    <Chip onRemove={() => setActiveExp('All')}>
                      Exp: {EXPERIENCE_BUCKETS.find((b) => b.key === activeExp)?.label}
                    </Chip>
                  )}
                  {minSalaryLpa > 0 && (
                    <Chip onRemove={() => setMinSalaryLpa(0)}>≥ ₹{minSalaryLpa} LPA</Chip>
                  )}
                </div>
              )}

              <p className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-4">
                {filtered.length} opening{filtered.length === 1 ? '' : 's'} matching your filters
              </p>

              {loading ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                  <Loader2 className="w-6 h-6 text-slate-400 mx-auto mb-3 animate-spin" />
                  <p className="text-sm font-bold text-slate-500">Loading jobs…</p>
                </div>
              ) : visible.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700">
                    {tab === 'saved'
                      ? "You haven't saved any jobs yet"
                      : tab === 'applied'
                      ? "You haven't applied to any jobs yet"
                      : 'No jobs match your filters'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {tab === 'all'
                      ? 'Try clearing a filter or broadening your search.'
                      : 'Tap the bookmark on any card to save it for later.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visible.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      query={search}
                      saved={savedIds.includes(job.id)}
                      applied={appliedIds.includes(job.id)}
                      onSave={() => handleSave(job.id)}
                      onApply={() => handleApply(job)}
                      onShare={() => handleShare(job)}
                      shareToast={shareToast?.id === job.id ? shareToast.msg : null}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-900"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: pageCount }).map((_, i) => {
                    const n = i + 1;
                    const active = n === currentPage;
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-9 h-9 inline-flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                          active
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={currentPage === pageCount}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-900"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Bottom CTAs */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 inline-flex items-center justify-center mb-4">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mb-1">
                    Market Outlook 2026
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Get exclusive insights into the Indian food safety job market. Salary trends,
                    top-paying cities, and in-demand certifications.
                  </p>
                  <a
                    href="mailto:hello@haccppro.com?subject=Market%20Outlook%202026%20Report"
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
                  >
                    Download Free Report <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-white/15 inline-flex items-center justify-center mb-4">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-extrabold mb-1">Upskill to Lead</h3>
                  <p className="text-xs text-indigo-100 leading-relaxed mb-4">
                    Quality managers with advanced HACCP certifications see a 35% jump in recruiter
                    interest. Start your journey today.
                  </p>
                  <a
                    href="/#courses"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-indigo-700 text-xs font-extrabold hover:bg-indigo-50 transition-colors"
                  >
                    Browse Certifications <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <JobPostForm open={postFormOpen} onClose={() => setPostFormOpen(false)} />
    </PublicSiteShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl px-3 py-3 ${
        accent ? 'bg-white text-emerald-700' : 'bg-white/10 text-white backdrop-blur'
      }`}
    >
      <div className={`text-xl font-black ${accent ? 'text-emerald-700' : 'text-white'}`}>
        {value}
      </div>
      <div
        className={`text-[10px] font-bold tracking-[0.18em] uppercase mt-0.5 ${
          accent ? 'text-emerald-600/80' : 'text-emerald-50/80'
        }`}
      >
        {label}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-100 my-5" />;
}

function TabPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
      <span
        className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${
          active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100"
    >
      {children}
      <X className="w-3 h-3" />
    </button>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
  tone,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  tone: 'emerald' | 'indigo';
}) {
  const activeBg = tone === 'emerald' ? 'bg-emerald-50' : 'bg-indigo-50';
  const activeDot = tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';
  const activeText = tone === 'emerald' ? 'text-emerald-700' : 'text-indigo-700';
  return (
    <div>
      <h3 className="text-[10px] font-black tracking-[0.18em] text-slate-400 mb-2">{label}</h3>
      <ul className="space-y-1">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <li key={opt}>
              <button
                onClick={() => onChange(opt)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                  active ? `${activeBg} ${activeText}` : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{opt}</span>
                {active && <span className={`w-2 h-2 rounded-full ${activeDot}`} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black tracking-[0.18em] text-slate-500 uppercase mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
    </label>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const segs = highlightSegments(text, query);
  return (
    <>
      {segs.map((s, i) =>
        s.match ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function JobCard({
  job,
  query,
  saved,
  applied,
  onSave,
  onApply,
  onShare,
  shareToast,
}: {
  job: Job;
  query: string;
  saved: boolean;
  applied: boolean;
  onSave: () => void;
  onApply: () => void;
  onShare: () => void;
  shareToast: string | null;
}) {
  const avatar = useMemo(() => companyAvatar(job.company), [job.company]);

  return (
    <article
      className={`group bg-white border rounded-2xl p-5 sm:p-6 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 ${
        job.promoted ? 'border-orange-200' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex gap-4">
        <Link
          href={`/jobs/${job.id}`}
          className={`hidden sm:flex w-14 h-14 shrink-0 rounded-xl ${avatar.bg} ${avatar.fg} items-center justify-center text-base font-black hover:scale-105 transition-transform`}
        >
          {avatar.initials}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/jobs/${job.id}`}
                  className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors"
                >
                  <Highlighted text={job.title} query={query} />
                </Link>
                {job.promoted && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-wider">
                    Promoted
                  </span>
                )}
                {applied && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> Applied
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 font-medium mt-0.5 inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <Highlighted text={job.company} query={query} />
              </p>
            </div>
            <div className="text-[11px] font-bold text-emerald-600 inline-flex items-center gap-1 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" />
              {formatPosted(job.postedHoursAgo)} ago
            </div>
          </div>

          {/* Meta grid */}
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            <MetaItem icon={<MapPin className="w-3.5 h-3.5" />} label="LOCATION" value={job.location} />
            <MetaItem icon={<Clock className="w-3.5 h-3.5" />} label="EXPERIENCE" value={job.experience || '—'} />
            <MetaItem
              icon={<IndianRupee className="w-3.5 h-3.5" />}
              label="ANNUAL SALARY"
              value={job.salary || '—'}
              valueClass="text-emerald-700"
            />
            <MetaItem icon={<Briefcase className="w-3.5 h-3.5" />} label="EMPLOYMENT" value={job.employment} />
          </dl>

          {/* Skills row */}
          {job.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 5).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold"
                >
                  {s}
                </span>
              ))}
              {job.skills.length > 5 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-bold">
                  +{job.skills.length - 5} more
                </span>
              )}
            </div>
          )}

          {/* Pills + actions */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {job.source && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-wider">
                  Via {job.source}
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                {job.area}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {shareToast && (
                <span className="text-[11px] font-bold text-emerald-600">{shareToast}</span>
              )}
              <button
                onClick={onShare}
                aria-label="Share job"
                title="Share"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={onSave}
                aria-label={saved ? 'Unsave job' : 'Save job'}
                title={saved ? 'Unsave' : 'Save for later'}
                className={`w-9 h-9 inline-flex items-center justify-center rounded-lg border transition-colors ${
                  saved
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'
                }`}
              >
                {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
              <Link
                href={`/jobs/${job.id}`}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold"
              >
                Details
              </Link>
              <button
                onClick={onApply}
                disabled={!job.applyUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-black disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-extrabold transition-colors"
              >
                Apply Now <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function MetaItem({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-slate-800 ${valueClass || ''}`}>
        <span className="text-slate-400">{icon}</span>
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
