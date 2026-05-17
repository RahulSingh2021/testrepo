'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Globe,
  GraduationCap,
  ListChecks,
  Loader2,
  LogIn,
  MapPin,
  Monitor,
  RefreshCcw,
  Share2,
  Star,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import LoginPage from './LoginPage';
import { usePublicOnlyMirror } from '@/utils/usePublicOnlyMirror';
import AcademyEnrolModal from './AcademyEnrolModal';
import { Entity } from '../types';

// Public course / training detail page mounted at /courses/[id]. The
// layout matches the user's reference screenshot: header with HACCP
// PRO branding + Sign In, breadcrumb, two-column grid (main column for
// title / description / outcomes / requirements, sticky sidebar for
// thumbnail / price / stats / Buy Now or Register Now CTA).

type Source = 'academy' | 'training';

interface DetailItem {
  source: Source;
  id: string;
  title: string;
  thumbnail?: string;
  short_description?: string;
  description?: string;
  language?: string;
  level?: string;
  duration?: number; // minutes (academy)
  price?: number;
  discount_price?: number;
  updated_at?: string;
  rating?: number;
  enrolment_count?: number;
  outcomes?: string[];
  requirements?: string[];
  // Academy-only:
  certificate?: boolean | string;
  expiryPeriod?: string;
  // Training-only:
  trainingDate?: string;
  trainingStartTime?: string;
  trainingEndTime?: string;
  trainingHours?: number;
  trainingMode?: string;
  trainingTrainer?: string;
  trainingLocation?: string;
}

const formatPrice = (n?: number) => {
  if (n == null) return '—';
  if (n <= 0) return 'Free';
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const formatHours = (mins?: number) => {
  if (!mins || mins <= 0) return '00:00:00';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

// Normalise an Academy course row from /api/academy/courses into the
// shared DetailItem shape used by this page.
function mapAcademy(c: any): DetailItem {
  return {
    source: 'academy',
    id: c.id,
    title: c.title || 'Untitled course',
    thumbnail: c.thumbnail,
    short_description: c.short_description,
    description: c.description,
    language: c.language,
    level: c.level,
    duration: typeof c.duration === 'number' ? c.duration : undefined,
    price: typeof c.price === 'number' ? c.price : undefined,
    discount_price:
      typeof c.discount_price === 'number' ? c.discount_price : undefined,
    updated_at: c.updated_at,
    rating: typeof c.rating === 'number' ? c.rating : undefined,
    enrolment_count:
      typeof c.enrolment_count === 'number' ? c.enrolment_count : undefined,
    outcomes: Array.isArray(c.outcomes) ? c.outcomes.filter(Boolean) : [],
    requirements: Array.isArray(c.requirements)
      ? c.requirements.filter(Boolean)
      : [],
    certificate: c.certificate ?? c.has_certificate,
    expiryPeriod: c.expiry_period || c.expiryPeriod,
  };
}

// Normalise a Training Calendar row (already filtered to PUBLIC_FIELDS
// by the ?public=1 server mode) into the shared DetailItem shape.
function mapTraining(t: any): DetailItem {
  const fee = typeof t.courseFee === 'number' ? t.courseFee : undefined;
  const disc = typeof t.discount === 'number' ? t.discount : 0;
  const hasDisc = fee != null && disc > 0;
  const titleParts = [t.topic, t.subTopic].filter(Boolean);
  return {
    source: 'training',
    id: t.id,
    title: titleParts.join(' — ') || 'Untitled training',
    thumbnail: t.thumbnailImage,
    short_description: t.description,
    description: t.description,
    level: t.mode,
    price: fee,
    discount_price: hasDisc ? Math.max(0, fee! - disc) : undefined,
    updated_at: t.date,
    trainingDate: t.date,
    trainingStartTime: t.startTime,
    trainingEndTime: t.endTime,
    trainingHours: typeof t.trainingHours === 'number' ? t.trainingHours : undefined,
    trainingMode: t.mode,
    trainingTrainer: t.trainer,
    trainingLocation: t.location,
  };
}

export default function CourseDetailPage({ id, initialPublicOnly = false }: { id: string; initialPublicOnly?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sourceHint = (searchParams?.get('source') || '') as Source | '';

  const [item, setItem] = useState<DetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lessonsCount, setLessonsCount] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  // Public-only mirror domains never expose login surfaces. Initial
  // value is passed from the page server component so SSR HTML
  // already omits the Sign In button on mirror hosts.
  const isMirror = usePublicOnlyMirror(initialPublicOnly);
  const [showEnrol, setShowEnrol] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);

  // Resolve the item from the appropriate public API. We trust the
  // ?source= hint when present, otherwise probe both endpoints (training
  // first, since the link is more likely to be a session for a public
  // visitor who arrived from the landing).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tryTraining = async () => {
          const r = await fetch('/api/training-calendar?public=1');
          if (!r.ok) return null;
          const j = await r.json();
          const arr: any[] = Array.isArray(j?.items) ? j.items : [];
          const hit = arr.find((t) => t && t.id === id);
          return hit ? mapTraining(hit) : null;
        };
        const tryAcademy = async () => {
          const r = await fetch('/api/academy/courses?status=Active');
          if (!r.ok) return null;
          const j = await r.json();
          const arr: any[] = Array.isArray(j?.items) ? j.items : [];
          const hit = arr.find((c) => c && c.id === id);
          return hit ? mapAcademy(hit) : null;
        };

        let resolved: DetailItem | null = null;
        if (sourceHint === 'training') {
          resolved = (await tryTraining()) || (await tryAcademy());
        } else if (sourceHint === 'academy') {
          resolved = (await tryAcademy()) || (await tryTraining());
        } else {
          resolved = (await tryTraining()) || (await tryAcademy());
        }

        if (cancelled) return;
        if (!resolved) {
          setNotFound(true);
          return;
        }
        setItem(resolved);

        // Best-effort lesson count for academy items so the sidebar can
        // show "Lectures : N" without blocking the main render.
        if (resolved.source === 'academy') {
          try {
            const r = await fetch(
              `/api/academy/lessons?course_id=${encodeURIComponent(resolved.id)}`,
            );
            const j = await r.json();
            const arr = Array.isArray(j?.items)
              ? j.items
              : Array.isArray(j)
              ? j
              : [];
            if (!cancelled) setLessonsCount(arr.length);
          } catch {
            if (!cancelled) setLessonsCount(0);
          }
        }
      } catch (e) {
        console.error('CourseDetailPage load failed', e);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, sourceHint]);

  // Fetch entities so the inline login modal supports entity-aware
  // sign-in (mirrors what ClientApp does on the landing).
  useEffect(() => {
    if (!showLogin || entities.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/entities');
        const j = await r.json();
        const arr = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
        if (!cancelled) setEntities(arr);
      } catch {
        /* keep empty list — admin/auditor login still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showLogin, entities.length]);

  // ESC + body scroll lock for the login modal (mirrors ClientApp).
  useEffect(() => {
    if (!showLogin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLogin(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showLogin]);

  const onLoginSuccess = (auth: any) => {
    try {
      localStorage.setItem('haccp_auth', JSON.stringify(auth));
      localStorage.removeItem('haccp_entityId');
    } catch {
      /* ignore storage errors */
    }
    // Send the visitor into the main app — ClientApp will pick up the
    // persisted auth state on mount and show the dashboard.
    router.push('/');
  };

  const hasDiscount =
    item != null &&
    typeof item.discount_price === 'number' &&
    item.discount_price >= 0 &&
    typeof item.price === 'number' &&
    item.price > item.discount_price;
  const finalPrice = useMemo(() => {
    if (!item) return undefined;
    return hasDiscount ? item.discount_price! : item.price;
  }, [item, hasDiscount]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shadow-md shadow-slate-900/20">
              HP
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-900 tracking-tight">
                HACCP <span className="text-indigo-600">PRO</span>
              </div>
              <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Food Safety Intelligence
              </div>
            </div>
          </Link>
          {!isMirror && (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest shadow-md shadow-indigo-500/30"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 text-[12px] font-bold text-slate-500 flex items-center gap-1.5">
        <Link href="/" className="hover:text-indigo-600">
          Home
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/" className="hover:text-indigo-600">
          Courses
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-400">Details</span>
      </nav>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading details…
          </div>
        ) : notFound || !item ? (
          <div className="py-32 text-center">
            <p className="text-lg font-extrabold text-slate-900">
              Sorry, we couldn&rsquo;t find that course.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              It may have been removed or is no longer active.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800"
            >
              Browse all courses
            </Link>
          </div>
        ) : (
          <DetailBody
            item={item}
            lessonsCount={lessonsCount}
            finalPrice={finalPrice}
            hasDiscount={hasDiscount}
            onBuy={() => {
              if (item.source === 'training') {
                window.open(
                  `/training-register/${item.id}`,
                  '_blank',
                  'noopener,noreferrer',
                );
                return;
              }
              setShowEnrol(true);
            }}
          />
        )}
      </main>

      {/* Sign In modal — never reachable on public-only mirror domains. */}
      {showLogin && !isMirror && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sign in"
          onMouseDown={() => setShowLogin(false)}
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm overflow-y-auto"
        >
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            aria-label="Close sign in"
            style={{ top: 'max(env(safe-area-inset-top), 12px)' }}
            className="fixed right-3 z-[60] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 shadow-lg ring-1 ring-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div onMouseDown={(e) => e.stopPropagation()}>
            <LoginPage onLogin={onLoginSuccess} entities={entities} />
          </div>
        </div>
      )}

      {/* Enrol modal — only for Academy items, never for trainings */}
      {showEnrol && item && item.source === 'academy' && (
        <AcademyEnrolModal
          course={{ id: item.id, title: item.title }}
          onClose={() => setShowEnrol(false)}
        />
      )}
    </div>
  );
}

function DetailBody({
  item,
  lessonsCount,
  finalPrice,
  hasDiscount,
  onBuy,
}: {
  item: DetailItem;
  lessonsCount: number | null;
  finalPrice?: number;
  hasDiscount: boolean;
  onBuy: () => void;
}) {
  const isTraining = item.source === 'training';
  const outcomes = item.outcomes || [];
  const requirements = item.requirements || [];
  const ratingRounded = item.rating ? Math.round(item.rating * 10) / 10 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
      {/* Main column */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
          {item.title}
        </h1>
        {item.short_description && (
          <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-3xl">
            {item.short_description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-bold text-slate-600">
          {(isTraining ? item.trainingTrainer : undefined) && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                {(item.trainingTrainer || 'T').charAt(0).toUpperCase()}
              </span>
              <span className="text-slate-500 font-semibold">Created by</span>
              <span className="text-indigo-600">{item.trainingTrainer}</span>
            </span>
          )}
          {ratingRounded > 0 && (
            <span className="inline-flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < Math.round(ratingRounded)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              ))}
              <span className="ml-1">({ratingRounded} Reviews)</span>
            </span>
          )}
          {isTraining ? (
            <>
              {item.trainingHours != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {item.trainingHours} Hours
                </span>
              )}
            </>
          ) : (
            item.duration != null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {formatHours(item.duration)} Hours
              </span>
            )
          )}
          {item.enrolment_count != null && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {item.enrolment_count} Enrolled
            </span>
          )}
        </div>

        {/* Sub-meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-500">
          {item.language && (
            <span className="inline-flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> {item.language}
            </span>
          )}
          {item.updated_at && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {isTraining ? 'Session date ' : 'Last updated '}
              {formatDate(item.updated_at)}
            </span>
          )}
        </div>

        {/* Tab strip (visual) */}
        <div className="mt-6 border-b border-slate-200 flex items-center gap-6 overflow-x-auto">
          {[
            'Overview',
            'Curriculum',
            isTraining ? 'Schedule' : 'Instructor',
            'Reviews',
            'Additional info',
          ].map((label, i) => (
            <span
              key={label}
              className={`pb-3 text-[12px] font-extrabold whitespace-nowrap ${
                i === 0
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        {/* White content card */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {item.description && (
            <section>
              <h3 className="text-base font-black text-slate-900">
                Course description
              </h3>
              <p className="mt-3 text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">
                {item.description}
              </p>
            </section>
          )}

          {!isTraining && item.short_description && (
            <section className="mt-6">
              <h4 className="text-sm font-extrabold text-slate-900">
                Who Should Take This Course?
              </h4>
              <p className="mt-2 text-[13px] text-slate-700 leading-relaxed">
                {item.short_description}
              </p>
            </section>
          )}

          {outcomes.length > 0 && (
            <section className="mt-8">
              <h3 className="text-base font-black text-slate-900">
                What will I learn?
              </h3>
              <ul className="mt-3 space-y-2.5">
                {outcomes.map((o, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-[13px] leading-snug text-slate-700"
                  >
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {requirements.length > 0 && (
            <section className="mt-8">
              <h3 className="text-base font-black text-slate-900">Requirements</h3>
              <ul className="mt-3 space-y-2 text-[13px] leading-snug text-slate-700 list-disc pl-5">
                {requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Training-only practical info */}
          {isTraining && (
            <section className="mt-8">
              <h3 className="text-base font-black text-slate-900">
                Session details
              </h3>
              <ul className="mt-3 space-y-2 text-[13px] text-slate-700">
                {item.trainingDate && (
                  <li className="flex gap-3">
                    <CalendarDays className="w-4 h-4 text-indigo-500 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-slate-900">Date:</span>{' '}
                      {formatDate(item.trainingDate)}
                    </div>
                  </li>
                )}
                {(item.trainingStartTime || item.trainingEndTime) && (
                  <li className="flex gap-3">
                    <Clock className="w-4 h-4 text-indigo-500 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-slate-900">Time:</span>{' '}
                      {[item.trainingStartTime, item.trainingEndTime]
                        .filter(Boolean)
                        .join(' – ')}
                    </div>
                  </li>
                )}
                {item.trainingMode && (
                  <li className="flex gap-3">
                    <Monitor className="w-4 h-4 text-indigo-500 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-slate-900">Mode:</span>{' '}
                      {item.trainingMode}
                    </div>
                  </li>
                )}
                {item.trainingTrainer && (
                  <li className="flex gap-3">
                    <UserIcon className="w-4 h-4 text-indigo-500 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-slate-900">
                        Trainer:
                      </span>{' '}
                      {item.trainingTrainer}
                    </div>
                  </li>
                )}
                {item.trainingLocation && (
                  <li className="flex gap-3">
                    <MapPin className="w-4 h-4 text-indigo-500 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-slate-900">
                        Location:
                      </span>{' '}
                      {item.trainingLocation}
                    </div>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="lg:sticky lg:top-24 self-start">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="aspect-[16/10] bg-slate-100">
            {item.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <BookOpen className="w-12 h-12" />
              </div>
            )}
          </div>

          {/* Price row */}
          <div className="px-5 pt-4 flex items-baseline gap-3">
            <span className="text-2xl font-black text-slate-900">
              {formatPrice(finalPrice)}
            </span>
            {hasDiscount && typeof item.price === 'number' && (
              <span className="text-sm font-extrabold text-slate-400 line-through">
                {formatPrice(item.price)}
              </span>
            )}
            <span className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-700">
              <RefreshCcw className="w-4 h-4" />
            </span>
          </div>

          {/* Stats list */}
          <ul className="mt-3 px-5 divide-y divide-slate-100 text-[13px]">
            {isTraining ? (
              <>
                {item.trainingDate && (
                  <StatRow
                    icon={<CalendarDays className="w-4 h-4" />}
                    label="Date"
                    value={formatDate(item.trainingDate)}
                  />
                )}
                {(item.trainingStartTime || item.trainingEndTime) && (
                  <StatRow
                    icon={<Clock className="w-4 h-4" />}
                    label="Time"
                    value={[item.trainingStartTime, item.trainingEndTime]
                      .filter(Boolean)
                      .join(' – ')}
                  />
                )}
                {item.trainingMode && (
                  <StatRow
                    icon={<Monitor className="w-4 h-4" />}
                    label="Mode"
                    value={item.trainingMode}
                  />
                )}
                {item.trainingTrainer && (
                  <StatRow
                    icon={<UserIcon className="w-4 h-4" />}
                    label="Trainer"
                    value={item.trainingTrainer}
                  />
                )}
                {item.trainingLocation && (
                  <StatRow
                    icon={<MapPin className="w-4 h-4" />}
                    label="Location"
                    value={item.trainingLocation}
                  />
                )}
              </>
            ) : (
              <>
                <StatRow
                  icon={<ListChecks className="w-4 h-4" />}
                  label="Lectures"
                  value={lessonsCount != null ? String(lessonsCount) : '—'}
                />
                <StatRow
                  icon={<GraduationCap className="w-4 h-4" />}
                  label="Skill level"
                  value={item.level || '—'}
                />
                {item.duration != null && (
                  <StatRow
                    icon={<Clock className="w-4 h-4" />}
                    label="Duration"
                    value={formatHours(item.duration)}
                  />
                )}
                <StatRow
                  icon={<CalendarDays className="w-4 h-4" />}
                  label="Expiry period"
                  value={item.expiryPeriod || 'Lifetime'}
                />
                <StatRow
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="Certificate"
                  value={
                    typeof item.certificate === 'string'
                      ? item.certificate
                      : item.certificate
                      ? 'Yes'
                      : 'No'
                  }
                />
              </>
            )}
          </ul>

          {/* CTA button */}
          <div className="p-5 pt-4">
            <button
              type="button"
              onClick={onBuy}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/30"
            >
              {isTraining ? (
                <>
                  <LogIn className="w-4 h-4" /> Register Now
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Buy now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share row */}
        <div className="mt-3 bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between text-[12px] font-bold text-slate-600">
          <span className="inline-flex items-center gap-2">
            <Share2 className="w-4 h-4 text-slate-400" /> Share this course
          </span>
        </div>
      </aside>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="py-2.5 flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 text-slate-500 font-bold">
        <span className="text-slate-400">{icon}</span>
        {label}
      </span>
      <span className="text-slate-900 font-extrabold text-right">{value}</span>
    </li>
  );
}
