'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen, Play, CheckCircle2, Clock, Star, Search, Filter, Grid3X3, List,
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Award, Trophy, Loader2,
  Video, FileText, Image as ImageIcon, Music, Globe, File, ArrowLeft, Timer,
  BarChart3, Users, Bookmark, AlertCircle, X, Send, Eye, Lock,
  Share2, Copy, Check, Wallet, IndianRupee, Tag, RefreshCw, Plus, MessageCircle
} from 'lucide-react';

const DUMMY_STUDENT_TOKEN = 'dummy-student-token';

interface AcademyStudentPortalProps {
  userId?: string;
  userName?: string;
  initialView?: 'dashboard' | 'catalog';
}

interface Course {
  id: string;
  title: string;
  description?: string;
  short_description?: string;
  category_id?: string;
  sub_category_id?: string;
  instructor_id?: string;
  instructor_name?: string;
  level?: string;
  status?: string;
  thumbnail?: string;
  duration?: number;
  requirements?: string[];
  outcomes?: string[];
  tags?: string[];
  rating?: number;
  rating_count?: number;
  enrolment_count?: number;
  created_at?: string;
  updated_at?: string;
  price?: number;
  discountPrice?: number;
  discount_price?: number;
}

interface Section {
  id: string;
  course_id: string;
  title: string;
  sort_order?: number;
}

interface Lesson {
  id: string;
  course_id: string;
  section_id?: string;
  title: string;
  content_type?: string;
  content_url?: string;
  content_html?: string;
  duration?: number;
  sort_order?: number;
}

interface Quiz {
  id: string;
  course_id?: string;
  section_id?: string;
  title: string;
  description?: string;
  time_limit?: number;
  passing_score?: number;
  max_attempts?: number;
}

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type?: string;
  options?: { id: string; text: string; is_correct?: boolean }[];
  correct_answer?: string;
  points?: number;
  sort_order?: number;
}

interface Enrolment {
  id: string;
  user_id: string;
  course_id: string;
  progress_percent?: number;
  status?: string;
  enrolled_at?: string;
  completed_at?: string;
}

interface WatchHistory {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  completed?: boolean;
  watched_at?: string;
}

interface Badge {
  id: string;
  user_id: string;
  course_id?: string;
  name: string;
  description?: string;
  icon?: string;
  awarded_at?: string;
}

interface Rating {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  review?: string;
  rated_at?: string;
}

interface CategoryItem {
  id: string;
  name: string;
  parent_id?: string;
}

interface QuizResult {
  id: string;
  user_id: string;
  quiz_id: string;
  course_id?: string;
  score: number;
  total_points: number;
  passed: boolean;
  answers?: Record<string, any>;
  submitted_at?: string;
}

type ViewState =
  | { view: 'dashboard' }
  | { view: 'catalog' }
  | { view: 'course-detail'; courseId: string }
  | { view: 'lesson-player'; courseId: string; lessonId: string }
  | { view: 'quiz'; courseId: string; quizId: string };

const DEMO_USER_ID = 'student-demo-001';

const LEVEL_COLORS: Record<string, string> = {
  Beginner: 'bg-emerald-100 text-emerald-700',
  Intermediate: 'bg-amber-100 text-amber-700',
  Advanced: 'bg-rose-100 text-rose-700',
};

const CONTENT_TYPE_ICONS: Record<string, React.FC<any>> = {
  video: Video,
  text: FileText,
  document: File,
  pdf: File,
  image: ImageIcon,
  audio: Music,
  iframe: Globe,
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StarRating({ rating, size = 16, interactive, onChange }: {
  rating: number; size?: number; interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={`${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} ${interactive ? 'cursor-pointer hover:text-amber-300' : ''}`}
          onClick={() => interactive && onChange?.(i)}
        />
      ))}
    </div>
  );
}

export default function AcademyStudentPortal({ userId, userName, initialView = 'dashboard' }: AcademyStudentPortalProps) {
  const effectiveUserId = userId || DEMO_USER_ID;
  const [resolvedName, setResolvedName] = useState<string>(userName || '');

  useEffect(() => {
    if (userName) { setResolvedName(userName); return; }
    fetch(`/api/lms?id=${encodeURIComponent(effectiveUserId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const name = d?.users?.[0]?.name || d?.items?.[0]?.name || d?.name || '';
        setResolvedName(name || 'Student');
      })
      .catch(() => setResolvedName('Student'));
  }, [effectiveUserId, userName]);

  const effectiveUserName = resolvedName || 'Student';

  const [viewState, setViewState] = useState<ViewState>({ view: initialView });
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userRatings, setUserRatings] = useState<Rating[]>([]);
  const [allRatings, setAllRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesRes, catsRes, enrolRes, whRes, badgeRes, userRatingRes, allRatingRes] = await Promise.all([
        fetch('/api/academy/courses?status=Active'),
        fetch('/api/academy/categories'),
        fetch(`/api/academy/enrolments?user_id=${effectiveUserId}`),
        fetch(`/api/academy/watch-history?user_id=${effectiveUserId}`),
        fetch(`/api/academy/badges?user_id=${effectiveUserId}`),
        fetch(`/api/academy/ratings?user_id=${effectiveUserId}`),
        fetch('/api/academy/ratings'),
      ]);
      const [cd, catd, ed, wd, bd, urd, ard] = await Promise.all([
        coursesRes.json(), catsRes.json(), enrolRes.json(), whRes.json(), badgeRes.json(), userRatingRes.json(), allRatingRes.json()
      ]);
      setCourses(cd.items || []);
      setCategories(catd.items || []);
      setEnrolments(ed.items || []);
      setWatchHistory(wd.items || []);
      setBadges(bd.items || []);
      setUserRatings(urd.items || []);
      setAllRatings(ard.items || []);
    } catch (e) {
      console.error('Failed to load academy data:', e);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const enrolledCourseIds = useMemo(() => new Set(enrolments.map(e => e.course_id)), [enrolments]);

  const getCourseProgress = useCallback((courseId: string) => {
    const enrolment = enrolments.find(e => e.course_id === courseId);
    return enrolment?.progress_percent || 0;
  }, [enrolments]);

  const isCourseCompleted = useCallback((courseId: string) => {
    const enrolment = enrolments.find(e => e.course_id === courseId);
    return enrolment?.status === 'Completed';
  }, [enrolments]);

  const navigate = useCallback((state: ViewState) => {
    setViewState(state);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Academy</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {viewState.view === 'dashboard' && (
        <StudentDashboard
          courses={courses}
          enrolments={enrolments}
          watchHistory={watchHistory}
          badges={badges}
          ratings={userRatings}
          userName={effectiveUserName}
          userId={effectiveUserId}
          onNavigate={navigate}
          getCourseProgress={getCourseProgress}
          isCourseCompleted={isCourseCompleted}
        />
      )}
      {viewState.view === 'catalog' && (
        <CourseCatalog
          courses={courses}
          categories={categories}
          enrolledCourseIds={enrolledCourseIds}
          allRatings={allRatings}
          onNavigate={navigate}
        />
      )}
      {viewState.view === 'course-detail' && (
        <CourseDetail
          courseId={viewState.courseId}
          courses={courses}
          categories={categories}
          enrolments={enrolments}
          userRatings={userRatings}
          watchHistory={watchHistory}
          userId={effectiveUserId}
          onNavigate={navigate}
          onEnrol={async (courseId, couponInfo) => {
            const id = generateId();
            const enrolment: Enrolment = { id, user_id: effectiveUserId, course_id: courseId, progress_percent: 0, status: 'Active', enrolled_at: new Date().toISOString() };
            const payload: any = { ...enrolment, enrollee_name: effectiveUserName };
            if (couponInfo) {
              payload.coupon_code = couponInfo.code;
            }
            await fetch('/api/academy/enrolments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            setEnrolments(prev => [...prev, enrolment]);
          }}
          onRate={async (courseId, ratingVal, review) => {
            const existing = userRatings.find(r => r.course_id === courseId && r.user_id === effectiveUserId);
            const id = existing?.id || generateId();
            const ratingObj: Rating = { id, user_id: effectiveUserId, course_id: courseId, rating: ratingVal, review, rated_at: new Date().toISOString() };
            await fetch('/api/academy/ratings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ratingObj) });
            setUserRatings(prev => {
              const filtered = prev.filter(r => r.id !== id);
              return [...filtered, ratingObj];
            });
            setAllRatings(prev => {
              const filtered = prev.filter(r => r.id !== id);
              return [...filtered, ratingObj];
            });
          }}
          getCourseProgress={getCourseProgress}
          isCourseCompleted={isCourseCompleted}
        />
      )}
      {viewState.view === 'lesson-player' && (
        <LessonPlayer
          courseId={viewState.courseId}
          initialLessonId={viewState.lessonId}
          courses={courses}
          userId={effectiveUserId}
          watchHistory={watchHistory}
          enrolments={enrolments}
          onNavigate={navigate}
          onWatchHistoryUpdate={(wh) => setWatchHistory(prev => {
            const filtered = prev.filter(w => w.id !== wh.id);
            return [...filtered, wh];
          })}
          onEnrolmentUpdate={(enr) => setEnrolments(prev => prev.map(e => e.id === enr.id ? enr : e))}
          onBadgeEarned={(badge) => setBadges(prev => [...prev, badge])}
        />
      )}
      {viewState.view === 'quiz' && (
        <QuizPlayer
          quizId={viewState.quizId}
          courseId={viewState.courseId}
          userId={effectiveUserId}
          onNavigate={navigate}
          onComplete={() => fetchAll()}
        />
      )}
    </div>
  );
}

function StudentDashboard({ courses, enrolments, watchHistory, badges, ratings, userName, userId, onNavigate, getCourseProgress, isCourseCompleted }: {
  courses: Course[]; enrolments: Enrolment[]; watchHistory: WatchHistory[]; badges: Badge[]; ratings: Rating[];
  userName: string; userId: string; onNavigate: (s: ViewState) => void;
  getCourseProgress: (id: string) => number; isCourseCompleted: (id: string) => boolean;
}) {
  const enrolledCourses = useMemo(() => {
    return enrolments.map(e => {
      const course = courses.find(c => c.id === e.course_id);
      return course ? { ...course, enrolment: e } : null;
    }).filter(Boolean) as (Course & { enrolment: Enrolment })[];
  }, [courses, enrolments]);

  const inProgress = enrolledCourses.filter(c => c.enrolment.status !== 'Completed');
  const completed = enrolledCourses.filter(c => c.enrolment.status === 'Completed');

  const recentActivity = useMemo(() => {
    return [...watchHistory]
      .sort((a, b) => new Date(b.watched_at || '').getTime() - new Date(a.watched_at || '').getTime())
      .slice(0, 8);
  }, [watchHistory]);

  const totalHours = useMemo(() => {
    const totalMin = enrolledCourses.reduce((sum, c) => sum + (c.duration || 0), 0);
    return Math.round(totalMin / 60);
  }, [enrolledCourses]);

  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">
            Welcome back, {userName}
          </h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Your learning journey at a glance
          </p>
        </div>
        <button
          onClick={() => onNavigate({ view: 'catalog' })}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <BookOpen size={14} /> Browse Courses
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 mb-3">
            <BookOpen size={18} />
          </div>
          <div className="text-3xl font-black text-slate-900 leading-none mb-1">{enrolledCourses.length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrolled Courses</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 mb-3">
            <CheckCircle2 size={18} />
          </div>
          <div className="text-3xl font-black text-slate-900 leading-none mb-1">{completed.length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 mb-3">
            <Clock size={18} />
          </div>
          <div className="text-3xl font-black text-slate-900 leading-none mb-1">{totalHours}h</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Learning Hours</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 mb-3">
            <Trophy size={18} />
          </div>
          <div className="text-3xl font-black text-slate-900 leading-none mb-1">{badges.length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Badges Earned</div>
        </div>
      </div>

      {inProgress.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-4">Continue Learning</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inProgress.map(course => {
              const progress = getCourseProgress(course.id);
              return (
                <div key={course.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate({ view: 'course-detail', courseId: course.id })}>
                  <div className="h-32 bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center">
                    {course.thumbnail ? (
                      <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen size={40} className="text-indigo-300" />
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {course.level && (
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${LEVEL_COLORS[course.level] || 'bg-slate-100 text-slate-600'}`}>
                          {course.level}
                        </span>
                      )}
                      {course.duration && (
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock size={10} />{formatDuration(course.duration)}</span>
                      )}
                    </div>
                    <h4 className="font-black text-sm text-slate-900 leading-tight mb-2 line-clamp-2">{course.title}</h4>
                    {course.instructor_name && (
                      <p className="text-[10px] font-bold text-slate-400 mb-3">{course.instructor_name}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-indigo-600">{progress}%</span>
                    </div>
                    <button className="mt-3 w-full px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2">
                      <Play size={12} /> Continue
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-4">Completed Courses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map(course => (
              <div key={course.id} className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate({ view: 'course-detail', courseId: course.id })}>
                <div className="h-24 bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center relative">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase">Completed</div>
                </div>
                <div className="p-4">
                  <h4 className="font-black text-sm text-slate-900 leading-tight mb-1 line-clamp-2">{course.title}</h4>
                  {course.instructor_name && (
                    <p className="text-[10px] font-bold text-slate-400 mb-2">{course.instructor_name}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600">100%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {badges.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-4">Earned Badges</h3>
          <div className="flex flex-wrap gap-3">
            {badges.map(badge => (
              <div key={badge.id} className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm flex items-center gap-3 min-w-[200px]">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <Award size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{badge.name}</p>
                  {badge.description && <p className="text-[10px] text-slate-400 font-bold">{badge.description}</p>}
                  {badge.awarded_at && <p className="text-[9px] text-slate-300 font-bold mt-0.5">{new Date(badge.awarded_at).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentActivity.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-4">Recent Activity</h3>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {recentActivity.map(wh => {
              const course = courses.find(c => c.id === wh.course_id);
              return (
                <div key={wh.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-all cursor-pointer"
                  onClick={() => onNavigate({ view: 'lesson-player', courseId: wh.course_id, lessonId: wh.lesson_id })}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${wh.completed ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
                    {wh.completed ? <CheckCircle2 size={14} /> : <Play size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{course?.title || 'Course'}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{wh.completed ? 'Completed lesson' : 'Watched lesson'}</p>
                  </div>
                  {wh.watched_at && (
                    <span className="text-[9px] font-bold text-slate-300">{new Date(wh.watched_at).toLocaleDateString()}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {enrolledCourses.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight mb-2">No Courses Yet</h3>
          <p className="text-sm text-slate-400 font-bold mb-6">Browse the course catalog and start your learning journey</p>
          <button onClick={() => onNavigate({ view: 'catalog' })} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
            Explore Courses
          </button>
        </div>
      )}

      <AffiliatePanel
        userId={userId}
        userName={userName}
        hasPaidEnrolment={enrolledCourses.some(c => Number(c.price || c.discountPrice || c.discount_price || 0) > 0)}
      />

      <WhatsAppAlertsToggle userId={userId} />
    </div>
  );
}

// Self-serve opt-out for the "Promote on WhatsApp" admin fan-out. The
// /api/whatsapp/training-promo route already skips any lms_users record
// whose `receiveTrainingAlerts` flag is explicitly false; this toggle is
// the only UI surface where a student can flip that flag, which keeps us
// compliant with WhatsApp's promotional-messaging guidance.
//
// Default is opted-IN (matches the server's "skip only when flag === false"
// behaviour), so we treat any value other than literal `false` as on.
function WhatsAppAlertsToggle({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lms?id=${encodeURIComponent(userId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const user = data?.items?.[0];
        // Only the explicit `false` value counts as opted-out, matching the
        // training-promo route. Missing/undefined → still opted-in.
        setEnabled(user?.receiveTrainingAlerts !== false);
      } catch {
        if (!cancelled) setEnabled(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const toggle = async () => {
    if (saving || loading || !userId) return;
    const next = !enabled;
    // Optimistic flip — we revert on error so the UI never lies about the
    // persisted value.
    setEnabled(next);
    setSaving(true);
    setError('');
    try {
      // The PATCH endpoint accepts either an admin session (LMS admin /
      // demo flow inside LearningManagement) or a student session bound
      // to the same userId. We forward whichever token we can find in
      // localStorage; the server enforces that at least one is valid.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const adminTok = window.localStorage.getItem('admin_session_token');
        if (adminTok) headers['x-admin-token'] = adminTok;
        const studentTok = window.localStorage.getItem(`student_session_token:${userId}`)
          || window.localStorage.getItem('student_session_token');
        if (studentTok) headers['x-student-token'] = studentTok;
      }
      const res = await fetch('/api/lms', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: userId, patch: { receiveTrainingAlerts: next } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setSavedAt(Date.now());
    } catch (err: any) {
      setEnabled(!next);
      setError(err?.message || 'Could not save preference. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 shrink-0">
          <MessageCircle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-1">
            WhatsApp Notifications
          </h3>
          <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
            Receive training alerts on WhatsApp when new sessions are announced.
            You can turn this off any time.
          </p>
          {error && (
            <p className="text-[10px] font-bold text-rose-600 mt-2">{error}</p>
          )}
          {!error && savedAt > 0 && (
            <p className="text-[10px] font-bold text-emerald-600 mt-2">
              Preference saved.
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Receive training alerts on WhatsApp"
          disabled={loading || saving || !userId}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-emerald-500' : 'bg-slate-300'
          } ${loading || saving || !userId ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

interface AffiliateCouponData {
  id: string;
  code: string;
  owner_id: string;
  owner_name: string;
  max_uses: number;
  current_uses: number;
  total_commission_earned: number;
  active: boolean;
  wallet_read_token?: string;
}

interface AffiliateTransaction {
  id: string;
  course_name?: string;
  commission_amount: number;
  created_at: string;
}

function AffiliatePanel({ userId, userName, hasPaidEnrolment }: { userId: string; userName: string; hasPaidEnrolment: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [coupon, setCoupon] = useState<AffiliateCouponData | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<AffiliateTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEarnings, setShowEarnings] = useState(false);
  const [studentToken, setStudentToken] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleAuth = async () => {
    if (!phoneInput.trim() || !userId) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      if (process.env.NODE_ENV !== 'production' && phoneInput.trim() === '00000000') {
        setStudentToken(DUMMY_STUDENT_TOKEN);
        setAuthLoading(false);
        return;
      }
      const res = await fetch('/api/academy/affiliate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, phone: phoneInput.trim() }),
      });
      const data = await res.json();
      if (data.token) {
        setStudentToken(data.token);
      } else {
        setAuthError(data.error || 'Verification failed. Check your phone number.');
      }
    } catch { setAuthError('Network error. Please try again.'); }
    setAuthLoading(false);
  };

  const fetchAffiliateData = useCallback(async () => {
    if (!userId || !studentToken) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'x-student-token': studentToken };
      const cRes = await fetch(`/api/academy/affiliate-coupons?user_id=${userId}`, { headers });
      const cd = await cRes.json();
      const items: AffiliateCouponData[] = cd.items || [];
      setCoupon(items.length > 0 ? items[0] : null);
      const wRes = await fetch(`/api/academy/affiliate-wallet?user_id=${userId}`, { headers });
      if (wRes.ok) {
        const wd = await wRes.json();
        if (wd.wallet) {
          setWalletBalance(wd.wallet.balance || 0);
          setTotalEarned(wd.wallet.total_earned || 0);
        }
        setTransactions(wd.transactions || []);
      }
    } catch {}
    setLoading(false);
  }, [userId, studentToken]);

  useEffect(() => {
    if (expanded && userId && studentToken) fetchAffiliateData();
  }, [expanded, fetchAffiliateData, userId, studentToken]);

  const handleGenerate = async () => {
    if (!studentToken) return;
    setGenerating(true);
    try {
      const settingsRes = await fetch('/api/academy/affiliate-settings');
      const settingsData = await settingsRes.json();
      const maxUses = settingsData.settings?.default_max_uses || 50;
      const res = await fetch('/api/academy/affiliate-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-token': studentToken },
        body: JSON.stringify({ owner_id: userId, owner_name: userName, max_uses: maxUses }),
      });
      const data = await res.json();
      if (data.coupon) {
        setCoupon(data.coupon);
      } else if (!res.ok && data.error) {
        console.warn('Coupon generation not allowed:', data.error);
      }
    } catch {}
    setGenerating(false);
  };

  const handleCopy = () => {
    if (!coupon) return;
    navigator.clipboard.writeText(coupon.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const handleWhatsApp = () => {
    if (!coupon) return;
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const text = encodeURIComponent(`Join me on HACCP PRO Academy! Use my referral code *${coupon.code}* when enrolling to get a discount on any paid course. 🎓\n\nEnroll here: ${siteUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const usePct = coupon ? Math.min(100, Math.round((coupon.current_uses / Math.max(coupon.max_uses, 1)) * 100)) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
            <Share2 size={16} />
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-slate-800 uppercase tracking-widest">My Referral Code</p>
            <p className="text-[10px] font-bold text-slate-400">Earn commissions by referring friends</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-violet-400" />
            </div>
          ) : !hasPaidEnrolment && !coupon ? (
            <div className="py-6 text-center opacity-60">
              <Lock size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-xs font-bold text-slate-500">Enrol in a paid course to unlock your referral code</p>
            </div>
          ) : !studentToken ? (
            <div className="py-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Verify Your Identity</p>
              <p className="text-xs text-slate-400 mb-4">Enter your registered phone number to access your referral dashboard.</p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAuth(); }}
                  placeholder="Registered phone number"
                  className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-violet-400 outline-none"
                />
                <button
                  onClick={handleAuth}
                  disabled={authLoading || !phoneInput.trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {authLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Verify
                </button>
              </div>
              {authError && <p className="text-[11px] text-red-500 font-bold mt-2">{authError}</p>}
            </div>
          ) : !coupon ? (
            <div className="py-6 text-center">
              <Share2 size={28} className="mx-auto text-violet-300 mb-3" />
              <p className="text-xs font-bold text-slate-500 mb-4">Generate your unique referral code</p>
              <button
                onClick={handleGenerate}
                disabled={generating || !hasPaidEnrolment}
                className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {hasPaidEnrolment ? 'Generate My Code' : 'Enrol in a paid course first'}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-4 border border-violet-100">
                <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">Your Referral Code</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-violet-800 tracking-[0.15em]">{coupon.code}</span>
                  <button onClick={handleCopy} className="p-2 bg-white rounded-xl border border-violet-200 hover:bg-violet-50 transition-all">
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-violet-500" />}
                  </button>
                  <button onClick={handleWhatsApp} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-1.5">
                    <Share2 size={12} /> Share
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-violet-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${coupon.current_uses >= coupon.max_uses ? 'bg-amber-400' : 'bg-violet-400'}`}
                      style={{ width: `${Math.min(100, Math.round((coupon.current_uses / Math.max(coupon.max_uses, 1)) * 100))}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-violet-600">{coupon.current_uses}/{coupon.max_uses} uses</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Wallet Balance</p>
                  <p className="text-xl font-black text-emerald-700 flex items-center gap-0.5">
                    <IndianRupee size={15} />{walletBalance.toLocaleString()}
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Total Earned</p>
                  <p className="text-xl font-black text-indigo-700 flex items-center gap-0.5">
                    <IndianRupee size={15} />{totalEarned.toLocaleString()}
                  </p>
                </div>
              </div>

              {transactions.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowEarnings(e => !e)}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-all"
                  >
                    <Wallet size={12} />
                    {showEarnings ? 'Hide' : 'View'} Earnings History ({transactions.length})
                    {showEarnings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showEarnings && (
                    <div className="mt-3 max-h-48 overflow-y-auto space-y-2 pr-1">
                      {transactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div>
                            <p className="text-xs font-bold text-slate-700">{tx.course_name || 'Course enrollment'}</p>
                            <p className="text-[9px] font-bold text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className="text-xs font-black text-emerald-600 flex items-center gap-0.5">
                            <IndianRupee size={11} />{tx.commission_amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={async () => {
                  if (!coupon) return;
                  if (!confirm('Regenerate your referral code? Your current code will be deactivated.')) return;
                  await fetch('/api/academy/affiliate-coupons', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-student-token': studentToken },
                    body: JSON.stringify({ coupon_id: coupon.id, owner_id: userId }),
                  });
                  setCoupon(null);
                  handleGenerate();
                }}
                disabled={generating}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={11} /> Regenerate Code (deactivates current)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CourseCatalog({ courses, categories, enrolledCourseIds, allRatings: allRatingsRaw, onNavigate }: {
  courses: Course[]; categories: CategoryItem[]; enrolledCourseIds: Set<string>; allRatings: Rating[];
  onNavigate: (s: ViewState) => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [gridView, setGridView] = useState(true);

  const ratingsByCourseLookup = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    allRatingsRaw.forEach(r => {
      if (!map[r.course_id]) map[r.course_id] = { total: 0, count: 0 };
      map[r.course_id].total += r.rating;
      map[r.course_id].count++;
    });
    return map;
  }, [allRatingsRaw]);

  const filtered = useMemo(() => {
    return courses.filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.title?.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q) && !c.short_description?.toLowerCase().includes(q)) return false;
      }
      if (categoryFilter && c.category_id !== categoryFilter) return false;
      if (levelFilter && c.level !== levelFilter) return false;
      return true;
    });
  }, [courses, search, categoryFilter, levelFilter]);

  const levels = useMemo(() => {
    const s = new Set(courses.map(c => c.level).filter(Boolean));
    return Array.from(s) as string[];
  }, [courses]);

  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => onNavigate({ view: 'dashboard' })} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Course Catalog</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{filtered.length} courses available</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none"
          />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none bg-white min-w-[140px]">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none bg-white min-w-[140px]">
          <option value="">All Levels</option>
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden">
          <button onClick={() => setGridView(true)} className={`p-2.5 ${gridView ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'} transition-all`}>
            <Grid3X3 size={16} />
          </button>
          <button onClick={() => setGridView(false)} className={`p-2.5 ${!gridView ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'} transition-all`}>
            <List size={16} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <Search size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-sm font-bold text-slate-500">No courses found matching your criteria</p>
        </div>
      ) : gridView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(course => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const courseRating = ratingsByCourseLookup[course.id];
            const avgRating = courseRating ? Math.round((courseRating.total / courseRating.count) * 10) / 10 : course.rating || 0;
            const ratingCount = courseRating?.count || course.rating_count || 0;
            const cat = categories.find(c => c.id === course.category_id);
            return (
              <div key={course.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate({ view: 'course-detail', courseId: course.id })}>
                <div className="h-36 bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center relative">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={40} className="text-indigo-300" />
                  )}
                  {isEnrolled && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase">Enrolled</div>
                  )}
                </div>
                <div className="p-4">
                  {cat && <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">{cat.name}</p>}
                  <h4 className="font-black text-sm text-slate-900 leading-tight mb-2 line-clamp-2">{course.title}</h4>
                  {course.short_description && <p className="text-[11px] text-slate-400 font-bold line-clamp-2 mb-3">{course.short_description}</p>}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {course.level && (
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${LEVEL_COLORS[course.level] || 'bg-slate-100 text-slate-600'}`}>
                        {course.level}
                      </span>
                    )}
                    {course.duration && (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock size={10} />{formatDuration(course.duration)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <StarRating rating={Math.round(avgRating)} size={12} />
                      {ratingCount > 0 && <span className="text-[9px] font-bold text-slate-400">({ratingCount})</span>}
                    </div>
                    {course.instructor_name && (
                      <span className="text-[10px] font-bold text-slate-400">{course.instructor_name}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(course => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const cat = categories.find(c => c.id === course.category_id);
            return (
              <div key={course.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate({ view: 'course-detail', courseId: course.id })}>
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center shrink-0">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <BookOpen size={24} className="text-indigo-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {cat && <span className="text-[9px] font-black text-indigo-500 uppercase">{cat.name}</span>}
                    {course.level && <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${LEVEL_COLORS[course.level] || 'bg-slate-100 text-slate-600'}`}>{course.level}</span>}
                    {isEnrolled && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[8px] font-black uppercase">Enrolled</span>}
                  </div>
                  <h4 className="font-black text-sm text-slate-900 leading-tight truncate">{course.title}</h4>
                  {course.short_description && <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{course.short_description}</p>}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {course.duration && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock size={10} />{formatDuration(course.duration)}</span>}
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CouponInfo {
  coupon_id: string;
  code: string;
  owner_id: string;
  owner_name: string;
  discount_percent: number;
  discount_amount: number;
  final_price: number;
  commission_amount: number;
  commission_percent: number;
  course_name: string;
}

function CourseDetail({ courseId, courses, categories, enrolments, userRatings, watchHistory, userId, onNavigate, onEnrol, onRate, getCourseProgress, isCourseCompleted }: {
  courseId: string; courses: Course[]; categories: CategoryItem[]; enrolments: Enrolment[]; userRatings: Rating[];
  watchHistory: WatchHistory[]; userId: string;
  onNavigate: (s: ViewState) => void; onEnrol: (courseId: string, couponInfo?: CouponInfo) => Promise<void>;
  onRate: (courseId: string, rating: number, review: string) => Promise<void>;
  getCourseProgress: (id: string) => number; isCourseCompleted: (id: string) => boolean;
}) {
  const course = courses.find(c => c.id === courseId);
  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courseRatings, setCourseRatings] = useState<Rating[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<(CouponInfo & { valid: true }) | { valid: false; error: string } | null>(null);

  const isEnrolled = enrolments.some(e => e.course_id === courseId);
  const completed = isCourseCompleted(courseId);
  const progress = getCourseProgress(courseId);
  const completedLessons = new Set(watchHistory.filter(w => w.course_id === courseId && w.completed).map(w => w.lesson_id));
  const existingRating = userRatings.find(r => r.course_id === courseId && r.user_id === userId);

  useEffect(() => {
    const load = async () => {
      setLoadingDetail(true);
      try {
        const [secRes, lesRes, quizRes, ratRes] = await Promise.all([
          fetch(`/api/academy/sections?course_id=${courseId}`),
          fetch(`/api/academy/lessons?course_id=${courseId}`),
          fetch(`/api/academy/quizzes?course_id=${courseId}`),
          fetch(`/api/academy/ratings?course_id=${courseId}`),
        ]);
        const [sd, ld, qd, rd] = await Promise.all([secRes.json(), lesRes.json(), quizRes.json(), ratRes.json()]);
        setSections(sd.items || []);
        setLessons(ld.items || []);
        setQuizzes(qd.items || []);
        setCourseRatings(rd.items || []);
        const allSectionIds = (sd.items || []).map((s: Section) => s.id);
        setExpandedSections(new Set(allSectionIds));
      } catch { }
      setLoadingDetail(false);
    };
    load();
  }, [courseId]);

  useEffect(() => {
    if (existingRating) {
      setRatingValue(existingRating.rating);
      setReviewText(existingRating.review || '');
    }
  }, [existingRating]);

  const avgRating = useMemo(() => {
    if (courseRatings.length === 0) return 0;
    return Math.round((courseRatings.reduce((s, r) => s + r.rating, 0) / courseRatings.length) * 10) / 10;
  }, [courseRatings]);

  const coursePrice = course ? (Number(course.price) || Number(course.discountPrice) || Number(course.discount_price) || 0) : 0;
  const isPaidCourse = coursePrice > 0;

  const handleValidateCoupon = useCallback(async (code?: string) => {
    const codeToUse = (code ?? couponCode).trim().toUpperCase();
    if (!codeToUse) return;
    setCouponValidating(true);
    setCouponResult(null);
    try {
      const res = await fetch('/api/academy/affiliate-coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToUse, course_price: coursePrice }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponResult({
          valid: true,
          coupon_id: data.coupon_id,
          code: data.code,
          owner_id: data.owner_id,
          owner_name: data.owner_name,
          discount_percent: data.discount_percent,
          discount_amount: data.discount_amount,
          final_price: data.final_price,
          commission_amount: data.commission_amount,
          commission_percent: data.commission_percent,
          course_name: course?.title || '',
        });
      } else {
        setCouponResult({ valid: false, error: data.error || 'Invalid coupon' });
      }
    } catch {
      setCouponResult({ valid: false, error: 'Failed to validate coupon' });
    }
    setCouponValidating(false);
  }, [couponCode, coursePrice, course]);

  useEffect(() => {
    if (!couponCode.trim() || !isPaidCourse) { setCouponResult(null); return; }
    const timer = setTimeout(() => { handleValidateCoupon(couponCode); }, 700);
    return () => clearTimeout(timer);
  }, [couponCode, isPaidCourse]);

  const handleEnrol = async () => {
    setEnrolling(true);
    let couponInfo: CouponInfo | undefined;
    if (couponResult && couponResult.valid) {
      const cr = couponResult as CouponInfo & { valid: true };
      couponInfo = { ...cr, course_name: course?.title || '' };
    }
    await onEnrol(courseId, couponInfo);
    setEnrolling(false);
  };

  const handleSubmitRating = async () => {
    if (ratingValue === 0) return;
    setSubmittingRating(true);
    await onRate(courseId, ratingValue, reviewText);
    setShowRating(false);
    setSubmittingRating(false);
  };

  const cat = categories.find(c => c.id === course?.category_id);

  const sortedSections = useMemo(() => [...sections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [sections]);

  const getLessonsForSection = useCallback((sectionId: string) => {
    return lessons.filter(l => l.section_id === sectionId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [lessons]);

  const firstLesson = useMemo(() => {
    if (sortedSections.length > 0) {
      const sectionLessons = getLessonsForSection(sortedSections[0].id);
      if (sectionLessons.length > 0) return sectionLessons[0];
    }
    return lessons[0] || null;
  }, [sortedSections, getLessonsForSection, lessons]);

  const getNextUncompletedLesson = useCallback(() => {
    for (const sec of sortedSections) {
      const secLessons = getLessonsForSection(sec.id);
      for (const l of secLessons) {
        if (!completedLessons.has(l.id)) return l;
      }
    }
    const unsectioned = lessons.filter(l => !l.section_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const l of unsectioned) {
      if (!completedLessons.has(l.id)) return l;
    }
    return firstLesson;
  }, [sortedSections, getLessonsForSection, completedLessons, lessons, firstLesson]);

  if (!course) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500 font-bold">Course not found</p>
        <button onClick={() => onNavigate({ view: 'catalog' })} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase">Back to Catalog</button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white px-4 md:px-8 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => onNavigate(isEnrolled ? { view: 'dashboard' } : { view: 'catalog' })} className="flex items-center gap-2 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest mb-6 transition-all">
            <ArrowLeft size={14} /> {isEnrolled ? 'Dashboard' : 'Catalog'}
          </button>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {cat && <span className="px-2 py-0.5 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest">{cat.name}</span>}
                {course.level && <span className="px-2 py-0.5 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest">{course.level}</span>}
              </div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight mb-4">{course.title}</h1>
              {course.short_description && <p className="text-sm text-white/70 font-bold mb-4 leading-relaxed">{course.short_description}</p>}
              <div className="flex items-center gap-4 flex-wrap text-sm">
                {course.instructor_name && (
                  <span className="flex items-center gap-1.5 text-white/60 font-bold"><Users size={14} /> {course.instructor_name}</span>
                )}
                {course.duration && (
                  <span className="flex items-center gap-1.5 text-white/60 font-bold"><Clock size={14} /> {formatDuration(course.duration)}</span>
                )}
                <span className="flex items-center gap-1.5 text-white/60 font-bold"><BookOpen size={14} /> {lessons.length} lessons</span>
                {avgRating > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-400 font-bold"><Star size={14} className="fill-amber-400" /> {avgRating} ({courseRatings.length})</span>
                )}
              </div>
              {isEnrolled && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 max-w-xs h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-black text-emerald-400">{progress}% complete</span>
                </div>
              )}
            </div>
            <div className="shrink-0 flex flex-col gap-3 w-full md:w-72">
              {!isEnrolled ? (
                <>
                  {isPaidCourse && (
                    <div className="bg-white/10 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag size={13} className="text-white/70" />
                        <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Referral Code (optional)</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={couponCode}
                          onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') handleValidateCoupon(); }}
                          placeholder="e.g. NITE7K4"
                          maxLength={10}
                          className="flex-1 px-3 py-2 bg-white/20 border border-white/20 rounded-xl text-xs font-black text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 tracking-widest"
                        />
                        <button
                          onClick={handleValidateCoupon}
                          disabled={!couponCode.trim() || couponValidating}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-1"
                        >
                          {couponValidating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Apply
                        </button>
                      </div>
                      {couponResult && (
                        couponResult.valid ? (
                          <div className="flex items-start gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-3 py-2">
                            <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                                {(couponResult as CouponInfo).discount_percent}% off applied!
                              </p>
                              <p className="text-[10px] font-bold text-white/70">
                                Pay ₹{(couponResult as CouponInfo).final_price.toLocaleString()} instead of ₹{coursePrice.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-rose-500/20 border border-rose-400/30 rounded-xl px-3 py-2">
                            <AlertCircle size={12} className="text-rose-400 shrink-0" />
                            <p className="text-[10px] font-bold text-rose-300">{(couponResult as { valid: false; error: string }).error}</p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  <button onClick={handleEnrol} disabled={enrolling} className="px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 justify-center">
                  {enrolling ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>
                </>
              ) : (
                <button onClick={() => {
                  const nextLesson = getNextUncompletedLesson();
                  if (nextLesson) onNavigate({ view: 'lesson-player', courseId, lessonId: nextLesson.id });
                }} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                  <Play size={16} /> {completed ? 'Review Course' : 'Continue Learning'}
                </button>
              )}
              {completed && (
                <button onClick={() => setShowRating(true)} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                  <Star size={14} /> {existingRating ? 'Update Rating' : 'Rate Course'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {course.description && (
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-3">About This Course</h3>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{course.description}</p>
                </div>
              </div>
            )}

            {(course.requirements?.length || course.outcomes?.length) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {course.requirements && course.requirements.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-3">Requirements</h4>
                    <ul className="space-y-2">
                      {course.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {course.outcomes && course.outcomes.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-3">What You'll Learn</h4>
                    <ul className="space-y-2">
                      {course.outcomes.map((out, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                          {out}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-3">Curriculum</h3>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {sortedSections.length > 0 ? (
                  sortedSections.map(section => {
                    const sectionLessons = getLessonsForSection(section.id);
                    const sectionQuizzes = quizzes.filter(q => q.section_id === section.id);
                    const isExpanded = expandedSections.has(section.id);
                    const completedCount = sectionLessons.filter(l => completedLessons.has(l.id)).length;
                    return (
                      <div key={section.id} className="border-b border-slate-50 last:border-0">
                        <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-all" onClick={() => setExpandedSections(prev => {
                          const next = new Set(prev);
                          if (next.has(section.id)) next.delete(section.id); else next.add(section.id);
                          return next;
                        })}>
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            <span className="font-black text-sm text-slate-800">{section.title}</span>
                            <span className="text-[10px] font-bold text-slate-400">{sectionLessons.length} lessons</span>
                          </div>
                          {isEnrolled && (
                            <span className="text-[10px] font-black text-indigo-500">{completedCount}/{sectionLessons.length}</span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-3">
                            {sectionLessons.map(lesson => {
                              const isComplete = completedLessons.has(lesson.id);
                              const Icon = CONTENT_TYPE_ICONS[lesson.content_type || 'text'] || FileText;
                              return (
                                <div key={lesson.id}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${isEnrolled ? 'cursor-pointer hover:bg-indigo-50' : 'opacity-70'}`}
                                  onClick={() => isEnrolled && onNavigate({ view: 'lesson-player', courseId, lessonId: lesson.id })}
                                >
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {isComplete ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                                  </div>
                                  <span className={`flex-1 text-xs font-bold ${isComplete ? 'text-slate-500' : 'text-slate-700'}`}>{lesson.title}</span>
                                  {lesson.duration && <span className="text-[10px] text-slate-400 font-bold">{formatDuration(lesson.duration)}</span>}
                                  {!isEnrolled && <Lock size={12} className="text-slate-300" />}
                                </div>
                              );
                            })}
                            {sectionQuizzes.map(quiz => (
                              <div key={quiz.id}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${isEnrolled ? 'cursor-pointer hover:bg-amber-50' : 'opacity-70'}`}
                                onClick={() => isEnrolled && onNavigate({ view: 'quiz', courseId, quizId: quiz.id })}
                              >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
                                  <BarChart3 size={14} />
                                </div>
                                <span className="flex-1 text-xs font-bold text-slate-700">{quiz.title}</span>
                                <span className="text-[9px] font-black text-amber-600 uppercase">Quiz</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : lessons.length > 0 ? (
                  <div className="p-3">
                    {lessons.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(lesson => {
                      const isComplete = completedLessons.has(lesson.id);
                      const Icon = CONTENT_TYPE_ICONS[lesson.content_type || 'text'] || FileText;
                      return (
                        <div key={lesson.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${isEnrolled ? 'cursor-pointer hover:bg-indigo-50' : 'opacity-70'}`}
                          onClick={() => isEnrolled && onNavigate({ view: 'lesson-player', courseId, lessonId: lesson.id })}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {isComplete ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                          </div>
                          <span className={`flex-1 text-xs font-bold ${isComplete ? 'text-slate-500' : 'text-slate-700'}`}>{lesson.title}</span>
                          {lesson.duration && <span className="text-[10px] text-slate-400 font-bold">{formatDuration(lesson.duration)}</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400 font-bold">No lessons yet</div>
                )}

                {quizzes.filter(q => !q.section_id).length > 0 && (
                  <div className="border-t border-slate-100 p-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Course Quizzes</p>
                    {quizzes.filter(q => !q.section_id).map(quiz => (
                      <div key={quiz.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${isEnrolled ? 'cursor-pointer hover:bg-amber-50' : 'opacity-70'}`}
                        onClick={() => isEnrolled && onNavigate({ view: 'quiz', courseId, quizId: quiz.id })}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
                          <BarChart3 size={14} />
                        </div>
                        <span className="flex-1 text-xs font-bold text-slate-700">{quiz.title}</span>
                        {quiz.time_limit && <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Timer size={10} />{quiz.time_limit}m</span>}
                        <span className="text-[9px] font-black text-amber-600 uppercase">Quiz</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {courseRatings.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em] mb-3">Ratings & Reviews</h3>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl font-black text-slate-900">{avgRating}</div>
                    <div>
                      <StarRating rating={Math.round(avgRating)} size={18} />
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{courseRatings.length} review{courseRatings.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {courseRatings.slice(0, 5).map(r => (
                      <div key={r.id} className="border-t border-slate-50 pt-3">
                        <div className="flex items-center gap-2 mb-1">
                          <StarRating rating={r.rating} size={12} />
                          <span className="text-[10px] font-bold text-slate-400">{r.rated_at ? new Date(r.rated_at).toLocaleDateString() : ''}</span>
                        </div>
                        {r.review && <p className="text-xs text-slate-600">{r.review}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showRating && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Rate This Course</h3>
              <button onClick={() => setShowRating(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="flex justify-center mb-6">
              <StarRating rating={ratingValue} size={32} interactive onChange={setRatingValue} />
            </div>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Share your experience (optional)..."
              className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-indigo-400 outline-none resize-none h-24"
            />
            <button onClick={handleSubmitRating} disabled={ratingValue === 0 || submittingRating}
              className="mt-4 w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submittingRating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submittingRating ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonPlayer({ courseId, initialLessonId, courses, userId, watchHistory, enrolments, onNavigate, onWatchHistoryUpdate, onEnrolmentUpdate, onBadgeEarned }: {
  courseId: string; initialLessonId: string; courses: Course[]; userId: string;
  watchHistory: WatchHistory[]; enrolments: Enrolment[];
  onNavigate: (s: ViewState) => void;
  onWatchHistoryUpdate: (wh: WatchHistory) => void;
  onEnrolmentUpdate: (enr: Enrolment) => void;
  onBadgeEarned?: (badge: Badge) => void;
}) {
  const course = courses.find(c => c.id === courseId);
  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState(initialLessonId);
  const [loadingPlayer, setLoadingPlayer] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [localWatchHistory, setLocalWatchHistory] = useState<Set<string>>(new Set(watchHistory.filter(w => w.course_id === courseId && w.completed).map(w => w.lesson_id)));

  useEffect(() => {
    setLocalWatchHistory(new Set(watchHistory.filter(w => w.course_id === courseId && w.completed).map(w => w.lesson_id)));
  }, [watchHistory, courseId]);

  useEffect(() => {
    const load = async () => {
      setLoadingPlayer(true);
      try {
        const [secRes, lesRes, quizRes] = await Promise.all([
          fetch(`/api/academy/sections?course_id=${courseId}`),
          fetch(`/api/academy/lessons?course_id=${courseId}`),
          fetch(`/api/academy/quizzes?course_id=${courseId}`),
        ]);
        const [sd, ld, qd] = await Promise.all([secRes.json(), lesRes.json(), quizRes.json()]);
        setSections(sd.items || []);
        setLessons(ld.items || []);
        setQuizzes(qd.items || []);
      } catch { }
      setLoadingPlayer(false);
    };
    load();
  }, [courseId]);

  const currentLesson = lessons.find(l => l.id === currentLessonId);
  const sortedSections = useMemo(() => [...sections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [sections]);
  const allLessonsOrdered = useMemo(() => {
    const ordered: Lesson[] = [];
    for (const sec of sortedSections) {
      const secLessons = lessons.filter(l => l.section_id === sec.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      ordered.push(...secLessons);
    }
    const unsectioned = lessons.filter(l => !l.section_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    ordered.push(...unsectioned);
    return ordered;
  }, [sortedSections, lessons]);

  const currentIndex = allLessonsOrdered.findIndex(l => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? allLessonsOrdered[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessonsOrdered.length - 1 ? allLessonsOrdered[currentIndex + 1] : null;

  const markComplete = useCallback(async (lessonId: string) => {
    if (localWatchHistory.has(lessonId)) return;

    const whId = `${userId}-${courseId}-${lessonId}`;
    const wh: WatchHistory = { id: whId, user_id: userId, course_id: courseId, lesson_id: lessonId, completed: true, watched_at: new Date().toISOString() };

    try {
      await fetch('/api/academy/watch-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wh) });
      setLocalWatchHistory(prev => new Set([...prev, lessonId]));
      onWatchHistoryUpdate(wh);

      const totalLessons = allLessonsOrdered.length;
      const completedCount = new Set([...localWatchHistory, lessonId]).size;
      const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
      const enrolment = enrolments.find(e => e.course_id === courseId);
      if (enrolment) {
        const updatedEnrolment: Enrolment = {
          ...enrolment,
          progress_percent: progressPercent,
          status: progressPercent >= 100 ? 'Completed' : 'Active',
          completed_at: progressPercent >= 100 ? new Date().toISOString() : undefined,
        };
        await fetch('/api/academy/enrolments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedEnrolment) });
        onEnrolmentUpdate(updatedEnrolment);

        if (progressPercent >= 100) {
          const badgeId = `badge-${userId}-${courseId}`;
          const badgeObj: Badge = { id: badgeId, user_id: userId, course_id: courseId, name: `Completed: ${course?.title || 'Course'}`, description: 'Course completion badge', awarded_at: new Date().toISOString() };
          await fetch('/api/academy/badges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(badgeObj)
          });
          onBadgeEarned?.(badgeObj);
        }
      }
    } catch (e) {
      console.error('Failed to mark lesson complete:', e);
    }
  }, [userId, courseId, localWatchHistory, allLessonsOrdered, enrolments, onWatchHistoryUpdate, onEnrolmentUpdate, onBadgeEarned, course]);

  useEffect(() => {
    if (currentLessonId && !loadingPlayer) {
      const timer = setTimeout(() => markComplete(currentLessonId), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentLessonId, loadingPlayer, markComplete]);

  const navigateToLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
  };

  if (loadingPlayer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  const completedCount = localWatchHistory.size;
  const totalLessons = allLessonsOrdered.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="flex h-[calc(100vh-120px)] animate-in fade-in duration-500">
      {sidebarOpen && (
        <div className="w-80 bg-white border-r border-slate-100 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100">
            <button onClick={() => onNavigate({ view: 'course-detail', courseId })} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-xs font-bold uppercase tracking-widest mb-3 transition-all">
              <ArrowLeft size={12} /> Back to Course
            </button>
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight leading-tight line-clamp-2">{course?.title}</h3>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="text-[9px] font-black text-indigo-600">{progressPercent}%</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sortedSections.map(section => {
              const sectionLessons = lessons.filter(l => l.section_id === section.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
              const sectionQuizzes = quizzes.filter(q => q.section_id === section.id);
              return (
                <div key={section.id} className="mb-2">
                  <p className="px-2 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">{section.title}</p>
                  {sectionLessons.map(lesson => {
                    const isCurrent = lesson.id === currentLessonId;
                    const isComplete = localWatchHistory.has(lesson.id);
                    const Icon = CONTENT_TYPE_ICONS[lesson.content_type || 'text'] || FileText;
                    return (
                      <button key={lesson.id} onClick={() => navigateToLesson(lesson.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left mb-0.5 transition-all ${isCurrent ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'}`}>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isComplete ? 'bg-emerald-100 text-emerald-600' : isCurrent ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          {isComplete ? <CheckCircle2 size={12} /> : <Icon size={12} />}
                        </div>
                        <span className={`text-[11px] font-bold truncate ${isCurrent ? 'text-indigo-700' : 'text-slate-600'}`}>{lesson.title}</span>
                      </button>
                    );
                  })}
                  {sectionQuizzes.map(quiz => (
                    <button key={quiz.id} onClick={() => onNavigate({ view: 'quiz', courseId, quizId: quiz.id })}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left mb-0.5 hover:bg-amber-50 transition-all">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 text-amber-600">
                        <BarChart3 size={12} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 truncate">{quiz.title}</span>
                      <span className="text-[8px] font-black text-amber-600 uppercase ml-auto">Quiz</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {lessons.filter(l => !l.section_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(lesson => {
              const isCurrent = lesson.id === currentLessonId;
              const isComplete = localWatchHistory.has(lesson.id);
              const Icon = CONTENT_TYPE_ICONS[lesson.content_type || 'text'] || FileText;
              return (
                <button key={lesson.id} onClick={() => navigateToLesson(lesson.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left mb-0.5 transition-all ${isCurrent ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isComplete ? 'bg-emerald-100 text-emerald-600' : isCurrent ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    {isComplete ? <CheckCircle2 size={12} /> : <Icon size={12} />}
                  </div>
                  <span className={`text-[11px] font-bold truncate ${isCurrent ? 'text-indigo-700' : 'text-slate-600'}`}>{lesson.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
              {sidebarOpen ? <ChevronLeft size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
            </button>
            <span className="text-sm font-black text-slate-800 truncate">{currentLesson?.title || 'Select a lesson'}</span>
          </div>
          <div className="flex items-center gap-2">
            {prevLesson && (
              <button onClick={() => navigateToLesson(prevLesson.id)} className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-lg transition-all flex items-center gap-1">
                <ChevronLeft size={12} /> Previous
              </button>
            )}
            {nextLesson && (
              <button onClick={() => navigateToLesson(nextLesson.id)} className="px-3 py-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-1">
                Next <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50">
          {currentLesson ? (
            <LessonContentRenderer lesson={currentLesson} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-400 font-bold">Select a lesson from the sidebar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  const DOMPurify = require('dompurify');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li','a','b','strong','i','em','u','s','del','sub','sup','blockquote','pre','code','span','div','table','thead','tbody','tr','th','td','img','figure','figcaption','caption','details','summary','mark','abbr','dl','dt','dd'],
    ALLOWED_ATTR: ['href','src','alt','title','class','style','target','rel','width','height','colspan','rowspan','id'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script','iframe','object','embed','form','input','textarea','select','button','svg','math'],
    FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus','onblur'],
  });
}

function LessonContentRenderer({ lesson }: { lesson: Lesson }) {
  const contentType = lesson.content_type || 'text';

  if (contentType === 'video') {
    const url = lesson.content_url || '';
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    const isVimeo = url.includes('vimeo.com');

    if (isYoutube) {
      const videoId = url.includes('youtu.be') ? url.split('/').pop() : new URLSearchParams(url.split('?')[1] || '').get('v');
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
            <iframe src={`https://www.youtube.com/embed/${videoId}?rel=0`} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        </div>
      );
    }
    if (isVimeo) {
      const vimeoId = url.split('/').pop();
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
            <iframe src={`https://player.vimeo.com/video/${vimeoId}`} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen; picture-in-picture" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
          <video src={url} controls className="w-full h-full" controlsList="nodownload" />
        </div>
      </div>
    );
  }

  if (contentType === 'text' || contentType === 'document') {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-black text-slate-900 mb-4">{lesson.title}</h2>
          {lesson.content_html ? (
            <div className="prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content_html) }} />
          ) : lesson.content_url ? (
            <a href={lesson.content_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:underline">
              <File size={16} /> Open Document
            </a>
          ) : (
            <p className="text-sm text-slate-400 italic">No content available</p>
          )}
        </div>
      </div>
    );
  }

  if (contentType === 'pdf') {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="w-full max-w-4xl h-full">
          {lesson.content_url ? (
            <iframe src={lesson.content_url} className="w-full h-full rounded-2xl border border-slate-200 shadow-sm" />
          ) : (
            <div className="flex items-center justify-center h-full bg-white rounded-2xl border border-slate-200">
              <p className="text-sm text-slate-400 font-bold">No PDF available</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (contentType === 'image') {
    return (
      <div className="flex items-center justify-center h-full p-4">
        {lesson.content_url ? (
          <img src={lesson.content_url} alt={lesson.title} className="max-w-full max-h-full object-contain rounded-2xl shadow-lg" />
        ) : (
          <p className="text-sm text-slate-400 font-bold">No image available</p>
        )}
      </div>
    );
  }

  if (contentType === 'audio') {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center max-w-lg w-full">
          <Music size={48} className="text-indigo-300 mx-auto mb-4" />
          <h3 className="font-black text-lg text-slate-900 mb-4">{lesson.title}</h3>
          {lesson.content_url ? (
            <audio src={lesson.content_url} controls className="w-full" />
          ) : (
            <p className="text-sm text-slate-400 font-bold">No audio available</p>
          )}
        </div>
      </div>
    );
  }

  if (contentType === 'iframe') {
    return (
      <div className="h-full p-4">
        {lesson.content_url ? (
          <iframe src={lesson.content_url} className="w-full h-full rounded-2xl border border-slate-200 shadow-sm" allowFullScreen />
        ) : (
          <div className="flex items-center justify-center h-full bg-white rounded-2xl border border-slate-200">
            <p className="text-sm text-slate-400 font-bold">No content available</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <FileText size={48} className="text-slate-200 mx-auto mb-4" />
        <p className="text-sm text-slate-400 font-bold">Unsupported content type: {contentType}</p>
      </div>
    </div>
  );
}

function QuizPlayer({ quizId, courseId, userId, onNavigate, onComplete }: {
  quizId: string; courseId: string; userId: string;
  onNavigate: (s: ViewState) => void; onComplete: () => void;
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingQuiz(true);
      try {
        const [quizRes, qRes] = await Promise.all([
          fetch(`/api/academy/quizzes`),
          fetch(`/api/academy/quiz-questions?quiz_id=${quizId}`),
        ]);
        const [qd, qqd] = await Promise.all([quizRes.json(), qRes.json()]);
        const foundQuiz = (qd.items || []).find((q: Quiz) => q.id === quizId);
        setQuiz(foundQuiz || null);
        setQuestions(qqd.items || []);
        if (foundQuiz?.time_limit) {
          setTimeLeft(foundQuiz.time_limit * 60);
        }
      } catch { }
      setLoadingQuiz(false);
    };
    load();
  }, [quizId]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (!submitted) handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, submitted]);

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    let score = 0;
    let totalPoints = 0;

    questions.forEach(q => {
      const points = q.points || 1;
      totalPoints += points;
      const userAnswer = answers[q.id];

      if (q.question_type === 'radio' || q.question_type === 'true_false') {
        const correctOption = q.options?.find(o => o.is_correct);
        if (correctOption && userAnswer === correctOption.id) score += points;
      } else if (q.question_type === 'checkbox') {
        const correctIds = new Set(q.options?.filter(o => o.is_correct).map(o => o.id) || []);
        const userIds = new Set(Array.isArray(userAnswer) ? userAnswer : []);
        if (correctIds.size === userIds.size && [...correctIds].every(id => userIds.has(id))) score += points;
      } else if (q.question_type === 'fill_blank' || q.question_type === 'short_answer') {
        if (q.correct_answer && userAnswer && String(userAnswer).toLowerCase().trim() === String(q.correct_answer).toLowerCase().trim()) score += points;
      }
    });

    const passed = quiz?.passing_score ? (score / totalPoints) * 100 >= quiz.passing_score : score >= totalPoints * 0.7;
    const resultId = generateId();
    const quizResult: QuizResult = {
      id: resultId,
      user_id: userId,
      quiz_id: quizId,
      course_id: courseId,
      score,
      total_points: totalPoints,
      passed,
      answers,
      submitted_at: new Date().toISOString(),
    };

    try {
      await fetch('/api/academy/quiz-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quizResult) });
    } catch { }

    setResult(quizResult);
    setSubmitted(true);
    setSubmitting(false);
    onComplete();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loadingQuiz) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500 font-bold">Quiz not found or has no questions</p>
        <button onClick={() => onNavigate({ view: 'course-detail', courseId })} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase">Back to Course</button>
      </div>
    );
  }

  if (submitted && result) {
    const scorePercent = result.total_points > 0 ? Math.round((result.score / result.total_points) * 100) : 0;
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${result.passed ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {result.passed ? <Trophy size={36} className="text-emerald-600" /> : <AlertCircle size={36} className="text-rose-600" />}
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
            {result.passed ? 'Congratulations!' : 'Keep Trying!'}
          </h2>
          <p className="text-sm text-slate-500 font-bold mb-6">
            {result.passed ? 'You passed the quiz!' : `You need ${quiz.passing_score || 70}% to pass.`}
          </p>
          <div className="flex items-center justify-center gap-8 mb-6">
            <div>
              <div className="text-4xl font-black text-slate-900">{scorePercent}%</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</div>
            </div>
            <div>
              <div className="text-4xl font-black text-slate-900">{result.score}/{result.total_points}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points</div>
            </div>
          </div>
          <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 ${result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {result.passed ? 'PASSED' : 'FAILED'}
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => setShowReview(true)} className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
              <Eye size={14} /> Review Answers
            </button>
            <button onClick={() => onNavigate({ view: 'course-detail', courseId })} className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
              Back to Course
            </button>
          </div>
        </div>

        {showReview && (
          <div className="mt-6 space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Answer Review</h3>
            {questions.map((q, i) => {
              const userAnswer = answers[q.id];
              let isCorrect = false;
              if (q.question_type === 'radio' || q.question_type === 'true_false') {
                const correctOption = q.options?.find(o => o.is_correct);
                isCorrect = correctOption?.id === userAnswer;
              } else if (q.question_type === 'checkbox') {
                const correctIds = new Set(q.options?.filter(o => o.is_correct).map(o => o.id) || []);
                const userIds = new Set(Array.isArray(userAnswer) ? userAnswer : []);
                isCorrect = correctIds.size === userIds.size && [...correctIds].every(id => userIds.has(id));
              } else if (q.question_type === 'fill_blank' || q.question_type === 'short_answer') {
                isCorrect = q.correct_answer != null && userAnswer != null && String(userAnswer).toLowerCase().trim() === String(q.correct_answer).toLowerCase().trim();
              }

              return (
                <div key={q.id} className={`bg-white rounded-2xl border-2 p-5 ${isCorrect ? 'border-emerald-200' : 'border-rose-200'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{i + 1}</span>
                    <p className="text-sm font-bold text-slate-800 flex-1">{q.question_text}</p>
                    {isCorrect ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <X size={18} className="text-rose-500 shrink-0" />}
                  </div>
                  {q.options && (
                    <div className="ml-9 space-y-1">
                      {q.options.map(opt => {
                        const isSelected = q.question_type === 'checkbox' ? (Array.isArray(userAnswer) && userAnswer.includes(opt.id)) : userAnswer === opt.id;
                        const isCorrectOpt = opt.is_correct;
                        return (
                          <div key={opt.id} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isCorrectOpt ? 'bg-emerald-50 text-emerald-700' : isSelected && !isCorrectOpt ? 'bg-rose-50 text-rose-700' : 'text-slate-500'}`}>
                            {opt.text} {isCorrectOpt && <span className="text-emerald-500 ml-1">(correct)</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(q.question_type === 'fill_blank' || q.question_type === 'short_answer') && (
                    <div className="ml-9 mt-1">
                      <p className="text-xs text-slate-500"><span className="font-bold">Your answer:</span> {userAnswer || '(empty)'}</p>
                      {q.correct_answer && <p className="text-xs text-emerald-600"><span className="font-bold">Correct answer:</span> {q.correct_answer}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => onNavigate({ view: 'course-detail', courseId })} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-xs font-bold uppercase tracking-widest transition-all">
          <ArrowLeft size={14} /> Exit Quiz
        </button>
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black ${timeLeft < 60 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
            <Timer size={16} /> {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-800 uppercase tracking-tight">{quiz.title}</h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {currentQuestionIndex + 1} / {questions.length}
          </span>
        </div>

        <div className="px-3 py-2 border-b border-slate-50 flex gap-1 flex-wrap">
          {questions.map((q, i) => {
            const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
            return (
              <button key={q.id} onClick={() => setCurrentQuestionIndex(i)}
                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${i === currentQuestionIndex ? 'bg-indigo-500 text-white' : isAnswered ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          <div className="mb-6">
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2 block">Question {currentQuestionIndex + 1}</span>
            <p className="text-base font-bold text-slate-800 leading-relaxed">{currentQuestion.question_text}</p>
          </div>

          {(currentQuestion.question_type === 'radio' || currentQuestion.question_type === 'true_false') && currentQuestion.options && (
            <div className="space-y-2">
              {currentQuestion.options.map(opt => (
                <button key={opt.id} onClick={() => handleAnswer(currentQuestion.id, opt.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold ${answers[currentQuestion.id] === opt.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                  {opt.text}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.question_type === 'checkbox' && currentQuestion.options && (
            <div className="space-y-2">
              {currentQuestion.options.map(opt => {
                const selected = Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].includes(opt.id);
                return (
                  <button key={opt.id} onClick={() => {
                    const current = Array.isArray(answers[currentQuestion.id]) ? [...answers[currentQuestion.id]] : [];
                    if (selected) {
                      handleAnswer(currentQuestion.id, current.filter((id: string) => id !== opt.id));
                    } else {
                      handleAnswer(currentQuestion.id, [...current, opt.id]);
                    }
                  }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold flex items-center gap-3 ${selected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                      {selected && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          )}

          {(currentQuestion.question_type === 'fill_blank' || currentQuestion.question_type === 'short_answer') && (
            <div>
              {currentQuestion.question_type === 'short_answer' ? (
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={e => handleAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full border-2 border-slate-200 rounded-xl p-4 text-sm font-bold focus:border-indigo-400 outline-none resize-none h-32"
                />
              ) : (
                <input
                  type="text"
                  value={answers[currentQuestion.id] || ''}
                  onChange={e => handleAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none"
                />
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30 flex items-center gap-1">
            <ChevronLeft size={12} /> Previous
          </button>
          {currentQuestionIndex < questions.length - 1 ? (
            <button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
              className="px-4 py-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-1">
              Next <ChevronRight size={12} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? 'Grading...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
