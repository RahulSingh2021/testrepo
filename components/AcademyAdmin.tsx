"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BookOpen, Users, Award, FolderTree, LayoutDashboard,
  Plus, Trash2, Search, Edit2, X, Check, GripVertical,
  ChevronDown, ChevronRight, Video, FileText, Image as ImageIcon,
  Music, Code, Upload, Star, Clock, DollarSign, BarChart3,
  Layers, ListChecks, Trophy, UserPlus, Eye, Filter,
  GraduationCap, TrendingUp, CheckCircle2, AlertCircle,
  Hash, Type, ToggleLeft, MessageSquare, ArrowUp, ArrowDown,
  BadgeCheck, Target, Loader2, Share2, Wallet, Copy, ToggleRight,
  IndianRupee, RefreshCw, Lightbulb, Newspaper, CalendarDays, ExternalLink,
  Globe2, Briefcase, MapPin, Link2, Sparkles
} from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import WhatsAppInbox from '@/components/WhatsAppInbox';
import { normalizeImageUrl, isDriveFolderUrl } from '@/lib/normalizeImageUrl';

// Renders inline help/preview/warning under a cover-image URL input.
// Surfaces the most common authoring mistake: pasting a Google Drive
// FOLDER link (drive/folders/...) instead of a FILE link
// (file/d/.../view), which can never render as an <img src>.
function CoverImageHelper({ url }: { url: string }) {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return (
      <p className="mt-1 text-[10px] font-bold text-slate-400">
        Tip: paste a Google Drive sharing link for an INDIVIDUAL file
        (file/d/…/view) — we convert it to an embeddable URL automatically.
        Folder links (drive/folders/…) cannot be used as images.
      </p>
    );
  }
  if (isDriveFolderUrl(trimmed)) {
    return (
      <div className="mt-1 rounded-lg border-2 border-amber-300 bg-amber-50 p-2">
        <p className="text-[11px] font-extrabold text-amber-900">
          ⚠ This is a Google Drive FOLDER link, not an image.
        </p>
        <p className="mt-0.5 text-[10px] font-bold text-amber-800">
          Open the folder in Drive, right-click the image you want, choose
          "Get link", set it to "Anyone with the link", then paste the
          file/d/…/view URL here.
        </p>
      </div>
    );
  }
  const normalised = normalizeImageUrl(trimmed);
  return (
    <div className="mt-1 flex items-start gap-2">
      <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-100 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalised}
          alt="cover preview"
          className="w-full h-full object-cover"
          onError={(e) => {
            const t = e.currentTarget;
            t.style.display = 'none';
            const sib = t.nextElementSibling as HTMLElement | null;
            if (sib) sib.style.display = 'flex';
          }}
        />
        <div
          className="w-full h-full items-center justify-center text-[9px] font-bold text-rose-500 text-center px-1"
          style={{ display: 'none' }}
        >
          can't load
        </div>
      </div>
      <p className="text-[10px] font-bold text-slate-400 leading-snug">
        Live preview. If nothing loads, the image isn't publicly accessible —
        for Drive links, set sharing to "Anyone with the link".
      </p>
    </div>
  );
}

interface AcademyAdminProps {
  activeSubTab?: string;
  onSetSubTab?: (tab: string) => void;
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  categoryId: string;
  subCategoryId: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  price: number;
  discountPrice: number;
  status: 'draft' | 'published' | 'archived';
  instructorId: string;
  requirements: string[];
  outcomes: string[];
  metaTitle: string;
  metaDescription: string;
  totalLessons: number;
  totalEnrollments: number;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  subCategories: { id: string; name: string }[];
}

interface Section {
  id: string;
  courseId: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'text' | 'document' | 'image' | 'audio' | 'iframe';
  content: string;
  duration: number;
  order: number;
}

interface Quiz {
  id: string;
  courseId: string;
  title: string;
  passMarks: number;
  timeLimit: number;
  questions: Question[];
}

interface Question {
  id: string;
  type: 'mcq' | 'true-false' | 'fill-blank' | 'short-answer';
  text: string;
  options: string[];
  correctAnswer: string;
  marks: number;
}

interface Student {
  id: string;
  name: string;
  email: string;
  enrolledCourses: number;
  completedCourses: number;
  progress: number;
  enrolledAt: string;
  lastActive: string;
}

interface Enrollment {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  progress: number;
  enrolledAt: string;
  completedAt: string | null;
}

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  criteria: string;
  awardCount: number;
}

const MOCK_CATEGORIES: Category[] = [];
const MOCK_COURSES: Course[] = [];
const MOCK_SECTIONS: Section[] = [];
const MOCK_QUIZZES: Quiz[] = [];
const MOCK_STUDENTS: Student[] = [];
const MOCK_ENROLLMENTS: Enrollment[] = [];
const MOCK_BADGES: Badge[] = [];

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  intermediate: 'bg-amber-100 text-amber-700 border-amber-200',
  advanced: 'bg-rose-100 text-rose-700 border-rose-200',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
};

const LESSON_TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Video size={14} />,
  text: <FileText size={14} />,
  document: <FileText size={14} />,
  image: <ImageIcon size={14} />,
  audio: <Music size={14} />,
  iframe: <Code size={14} />,
};

const QUESTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  mcq: <ListChecks size={14} />,
  'true-false': <ToggleLeft size={14} />,
  'fill-blank': <Type size={14} />,
  'short-answer': <MessageSquare size={14} />,
};

type SubTab = 'academy-dashboard' | 'academy-courses' | 'academy-categories' | 'academy-curriculum' | 'academy-quizzes' | 'academy-students' | 'academy-badges' | 'academy-affiliates' | 'academy-content' | 'academy-news-keywords' | 'academy-news-media' | 'academy-tip-leads' | 'academy-jobs' | 'academy-whatsapp-inbox';

const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'academy-dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { key: 'academy-courses', label: 'Courses', icon: <BookOpen size={16} /> },
  { key: 'academy-categories', label: 'Categories', icon: <FolderTree size={16} /> },
  { key: 'academy-curriculum', label: 'Curriculum Builder', icon: <Layers size={16} /> },
  { key: 'academy-quizzes', label: 'Quiz Manager', icon: <ListChecks size={16} /> },
  { key: 'academy-students', label: 'Students', icon: <Users size={16} /> },
  { key: 'academy-badges', label: 'Badges', icon: <Trophy size={16} /> },
  { key: 'academy-affiliates', label: 'Affiliates', icon: <Share2 size={16} /> },
  { key: 'academy-content', label: 'Content', icon: <Newspaper size={16} /> },
  { key: 'academy-news-keywords', label: 'News Keywords', icon: <Hash size={16} /> },
  { key: 'academy-news-media',    label: 'News Media',    icon: <Globe2 size={16} /> },
  { key: 'academy-tip-leads', label: 'Tip Leads', icon: <Lightbulb size={16} /> },
  { key: 'academy-jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
  { key: 'academy-whatsapp-inbox', label: 'WhatsApp Inbox', icon: <MessageSquare size={16} /> },
];

export default function AcademyAdmin({ activeSubTab, onSetSubTab }: AcademyAdminProps) {
  const [currentTab, setCurrentTab] = useState<SubTab>((activeSubTab as SubTab) || 'academy-dashboard');

  useEffect(() => {
    if (activeSubTab && SUB_TABS.some(t => t.key === activeSubTab)) {
      setCurrentTab(activeSubTab as SubTab);
    }
  }, [activeSubTab]);

  const handleTabChange = (tab: SubTab) => {
    setCurrentTab(tab);
    onSetSubTab?.(tab);
  };
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/academy/courses').then(r => r.ok ? r.json() : null).then(d => { if (d?.items) setCourses(d.items); }).catch(() => {});
    fetch('/api/academy/categories').then(r => r.ok ? r.json() : null).then(d => { if (d?.items) setCategories(d.items); }).catch(() => {});
  }, []);
  const [sections, setSections] = useState<Section[]>(MOCK_SECTIONS);
  const [quizzes, setQuizzes] = useState<Quiz[]>(MOCK_QUIZZES);
  const [students] = useState<Student[]>(MOCK_STUDENTS);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(MOCK_ENROLLMENTS);
  const [badges, setBadges] = useState<Badge[]>(MOCK_BADGES);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Academy LMS</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Course & Student Administration</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1 overflow-x-auto py-1">
          {SUB_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                currentTab === tab.key
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {currentTab === 'academy-dashboard' && <AcademyDashboard courses={courses} students={students} enrollments={enrollments} />}
        {currentTab === 'academy-courses' && <CourseManagement courses={courses} setCourses={setCourses} categories={categories} sections={sections} setSections={setSections} onJumpToCurriculum={() => handleTabChange('academy-curriculum')} />}
        {currentTab === 'academy-categories' && <CategoryManagement categories={categories} setCategories={setCategories} />}
        {currentTab === 'academy-curriculum' && <CurriculumBuilder courses={courses} sections={sections} setSections={setSections} />}
        {currentTab === 'academy-quizzes' && <QuizManager courses={courses} quizzes={quizzes} setQuizzes={setQuizzes} />}
        {currentTab === 'academy-students' && <StudentManagement students={students} enrollments={enrollments} setEnrollments={setEnrollments} courses={courses} />}
        {currentTab === 'academy-badges' && <BadgeManagement badges={badges} setBadges={setBadges} />}
        {currentTab === 'academy-affiliates' && <AffiliatesManagement />}
        {currentTab === 'academy-content' && <ContentManagement />}
        {currentTab === 'academy-news-keywords' && <NewsKeywordsManagement />}
        {currentTab === 'academy-news-media'    && <NewsMediaManagement />}
        {currentTab === 'academy-tip-leads' && <TipLeadsManagement />}
        {currentTab === 'academy-jobs' && <JobsManagement />}
        {currentTab === 'academy-whatsapp-inbox' && <WhatsAppInbox />}
      </div>
    </div>
  );
}

function AcademyDashboard({ courses, students, enrollments }: { courses: Course[]; students: Student[]; enrollments: Enrollment[] }) {
  const totalLessons = courses.reduce((s, c) => s + c.totalLessons, 0);
  const totalEnrollments = enrollments.length;
  const totalRevenue = courses.reduce((s, c) => s + (c.discountPrice > 0 ? c.discountPrice : c.price) * c.totalEnrollments, 0);

  const statsCards = [
    { label: 'Total Courses', value: courses.length, icon: <BookOpen size={24} />, color: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-50' },
    { label: 'Total Lessons', value: totalLessons, icon: <Layers size={24} />, color: 'from-violet-500 to-purple-500', bg: 'bg-violet-50' },
    { label: 'Total Enrollments', value: totalEnrollments, icon: <Users size={24} />, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
    { label: 'Total Students', value: students.length, icon: <GraduationCap size={24} />, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
  ];

  const monthlyData = [
    { month: 'Jan', enrollments: 45 },
    { month: 'Feb', enrollments: 62 },
    { month: 'Mar', enrollments: 38 },
    { month: 'Apr', enrollments: 71 },
    { month: 'May', enrollments: 55 },
    { month: 'Jun', enrollments: 88 },
  ];
  const maxEnroll = Math.max(...monthlyData.map(d => d.enrollments));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${s.bg} group-hover:scale-110 transition-transform`}>
                {s.icon}
              </div>
              <TrendingUp size={16} className="text-emerald-500" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-3xl font-black text-slate-900 tracking-tight">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Enrollment Trends</h3>
          <div className="flex items-end gap-3 h-48">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">{d.enrollments}</span>
                <div
                  className="w-full bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-lg transition-all hover:from-indigo-600 hover:to-indigo-500"
                  style={{ height: `${(d.enrollments / maxEnroll) * 100}%`, minHeight: '8px' }}
                />
                <span className="text-[10px] font-black text-slate-400 uppercase">{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Revenue Overview</h3>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <DollarSign size={32} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-4xl font-black text-slate-900 tracking-tight">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Total Revenue (Placeholder)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Recent Courses</h3>
        <div className="space-y-3">
          {courses.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen size={16} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{c.title}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{c.totalLessons} lessons · {c.totalEnrollments} enrolled</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[c.status]}`}>{c.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CourseFaq { question: string; answer: string; }

interface CourseFormState {
  title: string;
  description: string;
  thumbnail: string;
  categoryId: string;
  subCategoryId: string;
  level: Course['level'];
  language: string;
  price: number;
  discountPrice: number;
  status: Course['status'];
  instructorId: string;
  requirements: string[];
  outcomes: string[];
  metaTitle: string;
  metaDescription: string;
  faqs: CourseFaq[];
}

const EMPTY_FORM: CourseFormState = {
  title: '', description: '', thumbnail: '', categoryId: '', subCategoryId: '',
  level: 'beginner', language: 'English', price: 0, discountPrice: 0,
  status: 'draft', instructorId: '', requirements: [''], outcomes: [''],
  metaTitle: '', metaDescription: '', faqs: [{ question: '', answer: '' }],
};

function CourseManagement({
  courses, setCourses, categories, sections, setSections, onJumpToCurriculum,
}: {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  categories: Category[];
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
  onJumpToCurriculum: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [showModal, setShowModal] = useState(false);
  // The Course Manager panel is divided into a 3-tab ribbon — Curriculum,
  // Basic, Info — that mirrors the reference screenshot. The other tabs
  // shown in the original WP design (enrol list, live classes, analytics,
  // pricing) have been intentionally omitted per the product brief.
  const [activeManagerTab, setActiveManagerTab] = useState<'curriculum' | 'basic' | 'info'>('basic');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseFormState>(EMPTY_FORM);

  const filtered = useMemo(() => courses.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    return matchQ
      && (filterCategory === 'all' || c.categoryId === filterCategory)
      && (filterStatus === 'all' || c.status === filterStatus)
      && (filterLevel === 'all' || c.level === filterLevel);
  }), [courses, search, filterCategory, filterStatus, filterLevel]);

  const openCreate = () => {
    setEditingCourse(null);
    setForm(EMPTY_FORM);
    setActiveManagerTab('basic');
    setShowModal(true);
  };

  const openEdit = (c: Course) => {
    setEditingCourse(c);
    // Merge the saved row into the form shape; faqs is a newer field so
    // legacy rows fall back to a single empty Q/A pair to render the UI.
    const cAny = c as Course & { faqs?: CourseFaq[] };
    setForm({
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      categoryId: c.categoryId,
      subCategoryId: c.subCategoryId,
      level: c.level,
      language: c.language,
      price: c.price,
      discountPrice: c.discountPrice,
      status: c.status,
      instructorId: c.instructorId,
      requirements: c.requirements.length ? c.requirements : [''],
      outcomes: c.outcomes.length ? c.outcomes : [''],
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      faqs:
        Array.isArray(cAny.faqs) && cAny.faqs.length > 0
          ? cAny.faqs
          : [{ question: '', answer: '' }],
    });
    setActiveManagerTab('basic');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const cleanedFaqs = form.faqs.filter((f) => f.question.trim() || f.answer.trim());
    let saved: Course & { faqs?: CourseFaq[] };
    if (editingCourse) {
      saved = {
        ...editingCourse,
        ...form,
        requirements: form.requirements.filter(r => r.trim()),
        outcomes: form.outcomes.filter(o => o.trim()),
        faqs: cleanedFaqs,
      };
      setCourses(prev => prev.map(c => c.id === editingCourse.id ? saved : c));
    } else {
      saved = {
        id: `crs-${Date.now()}`,
        ...form,
        requirements: form.requirements.filter(r => r.trim()),
        outcomes: form.outcomes.filter(o => o.trim()),
        faqs: cleanedFaqs,
        totalLessons: 0,
        totalEnrollments: 0,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setCourses(prev => [saved, ...prev]);
    }
    setShowModal(false);
    try { await fetch('/api/academy/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saved) }); } catch {}
  };

  // Curriculum-tab helpers — minimal section CRUD inline so the user can
  // line up sections without leaving the Course Manager. Lesson editing
  // still lives in the dedicated Curriculum Builder tab.
  const editingSections = useMemo(
    () => (editingCourse ? sections.filter(s => s.courseId === editingCourse.id).sort((a, b) => a.order - b.order) : []),
    [sections, editingCourse],
  );
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const addSection = () => {
    if (!editingCourse || !newSectionTitle.trim()) return;
    const next: Section = {
      id: `sec-${Date.now()}`,
      courseId: editingCourse.id,
      title: newSectionTitle.trim(),
      order: editingSections.length,
      lessons: [],
    };
    setSections(prev => [...prev, next]);
    setNewSectionTitle('');
  };
  const renameSection = (id: string, title: string) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, title } : s)));
  };
  const deleteSection = (id: string) => {
    if (!confirm('Delete this section and all its lessons?')) return;
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    setCourses(prev => prev.filter(c => c.id !== id));
    try { await fetch('/api/academy/courses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch {}
  };

  const selectedCategory = categories.find(c => c.id === form.categoryId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses..." className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
          <option value="all">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button onClick={openCreate} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5">
          <Plus size={14} /> New Course
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => {
          const cat = categories.find(ct => ct.id === c.categoryId);
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group">
              <div className="h-32 bg-gradient-to-br from-indigo-100 to-violet-50 flex items-center justify-center">
                <BookOpen size={40} className="text-indigo-300 group-hover:scale-110 transition-transform" />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${LEVEL_COLORS[c.level]}`}>{c.level}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  {cat && <span className="text-[10px] font-bold text-slate-400">{cat.icon} {cat.name}</span>}
                </div>
                <h4 className="text-sm font-black text-slate-900 mb-1 line-clamp-1">{c.title}</h4>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{c.description}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <span>{c.totalLessons} lessons</span>
                  <span>{c.totalEnrollments} enrolled</span>
                  <span>{c.price > 0 ? `$${c.discountPrice > 0 ? c.discountPrice : c.price}` : 'Free'}</span>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => openEdit(c)} className="flex-1 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1">
                    <Edit2 size={12} /> Edit
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <BookOpen size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-sm font-bold text-slate-400">No courses found</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[150] bg-slate-50 flex flex-col overflow-hidden">
          {/* Course title bar */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0">
              <Hash size={16} />
            </span>
            <h2 className="flex-1 text-base font-black text-slate-900 truncate">
              {editingCourse
                ? `Update: ${editingCourse.title || 'Untitled course'}`
                : 'Create new course'}
            </h2>
            <button
              onClick={() => setShowModal(false)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            >
              ← Back to course list
            </button>
            {editingCourse && (
              <a
                href={`/courses/${encodeURIComponent(editingCourse.id)}?source=academy`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              >
                View on frontend →
              </a>
            )}
            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all sm:hidden">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {/* COURSE MANAGER ribbon */}
          <div className="bg-white border-b border-slate-200 shrink-0">
            <div className="px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Course Manager
            </div>
            <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
              {([
                { key: 'curriculum', label: 'Curriculum', icon: <Layers size={14} /> },
                { key: 'basic', label: 'Basic', icon: <Edit2 size={14} /> },
                { key: 'info', label: 'Info', icon: <FileText size={14} /> },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveManagerTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                    activeManagerTab === t.key
                      ? 'text-indigo-700 border-indigo-600 bg-indigo-50'
                      : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              {activeManagerTab === 'basic' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Title *</label>
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Description</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none resize-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Thumbnail URL</label>
                    <input value={form.thumbnail} onChange={e => setForm({ ...form, thumbnail: e.target.value })} placeholder="https://..." className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Category</label>
                      <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value, subCategoryId: '' })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Sub-Category</label>
                      <select value={form.subCategoryId} onChange={e => setForm({ ...form, subCategoryId: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                        <option value="">Select Sub-Category</option>
                        {selectedCategory?.subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Level</label>
                      <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value as Course['level'] })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Language</label>
                      <input value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Status</label>
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Course['status'] })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Price ($)</label>
                      <input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Discount Price ($)</label>
                      <input type="number" value={form.discountPrice} onChange={e => setForm({ ...form, discountPrice: parseFloat(e.target.value) || 0 })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {activeManagerTab === 'info' && (
                <div className="space-y-7">
                  {/* Course FAQs */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Course faq</label>
                    <div className="space-y-3">
                      {form.faqs.map((f, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start">
                          <input
                            value={f.question}
                            onChange={e => { const next = [...form.faqs]; next[i] = { ...next[i], question: e.target.value }; setForm({ ...form, faqs: next }); }}
                            placeholder="Faq question"
                            className="border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none"
                          />
                          <textarea
                            value={f.answer}
                            onChange={e => { const next = [...form.faqs]; next[i] = { ...next[i], answer: e.target.value }; setForm({ ...form, faqs: next }); }}
                            placeholder="Answer"
                            rows={2}
                            className="border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none resize-none"
                          />
                          <div className="flex sm:flex-col gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, faqs: [...form.faqs, { question: '', answer: '' }] })}
                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl"
                              aria-label="Add another FAQ"
                            >
                              <Plus size={14} />
                            </button>
                            {form.faqs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, faqs: form.faqs.filter((_, j) => j !== i) })}
                                className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl"
                                aria-label="Remove FAQ"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirements */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Requirements</label>
                    {form.requirements.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <input value={r} onChange={e => { const reqs = [...form.requirements]; reqs[i] = e.target.value; setForm({ ...form, requirements: reqs }); }} className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-400 outline-none" placeholder={`Requirement ${i + 1}`} />
                        {form.requirements.length > 1 && <button onClick={() => setForm({ ...form, requirements: form.requirements.filter((_, j) => j !== i) })} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><X size={14} /></button>}
                      </div>
                    ))}
                    <button onClick={() => setForm({ ...form, requirements: [...form.requirements, ''] })} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Add Requirement</button>
                  </div>

                  {/* Outcomes */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Outcomes</label>
                    {form.outcomes.map((o, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <input value={o} onChange={e => { const outs = [...form.outcomes]; outs[i] = e.target.value; setForm({ ...form, outcomes: outs }); }} className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-400 outline-none" placeholder={`Outcome ${i + 1}`} />
                        {form.outcomes.length > 1 && <button onClick={() => setForm({ ...form, outcomes: form.outcomes.filter((_, j) => j !== i) })} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><X size={14} /></button>}
                      </div>
                    ))}
                    <button onClick={() => setForm({ ...form, outcomes: [...form.outcomes, ''] })} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Add Outcome</button>
                  </div>

                  {/* SEO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Meta Title</label>
                      <input value={form.metaTitle} onChange={e => setForm({ ...form, metaTitle: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Meta Description</label>
                      <input value={form.metaDescription} onChange={e => setForm({ ...form, metaDescription: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {activeManagerTab === 'curriculum' && (
                <div className="space-y-5">
                  {!editingCourse ? (
                    <div className="py-12 text-center">
                      <Layers size={36} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-sm font-black text-slate-500">Save the course first</p>
                      <p className="mt-1 text-xs text-slate-400">Fill in the basics, click <strong>Save</strong>, then come back here to add sections.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h4 className="text-sm font-black text-slate-900">Sections</h4>
                          <p className="text-[11px] font-bold text-slate-400">Outline the course chapters here. Add lessons inside each section from the Curriculum Builder tab.</p>
                        </div>
                        <button
                          type="button"
                          onClick={onJumpToCurriculum}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl"
                        >
                          Open Curriculum Builder →
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input
                          value={newSectionTitle}
                          onChange={e => setNewSectionTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSection(); } }}
                          placeholder="New section title"
                          className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none"
                        />
                        <button
                          type="button"
                          onClick={addSection}
                          disabled={!newSectionTitle.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={14} /> Add Section
                        </button>
                      </div>

                      {editingSections.length === 0 ? (
                        <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs font-bold text-slate-400">No sections yet. Add the first one above.</p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {editingSections.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl">
                              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-black shrink-0">
                                {i + 1}
                              </span>
                              <input
                                value={s.title}
                                onChange={e => renameSection(s.id, e.target.value)}
                                className="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {s.lessons.length} lesson{s.lessons.length === 1 ? '' : 's'}
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteSection(s.id)}
                                className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"
                                aria-label="Delete section"
                              >
                                <Trash2 size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3 shrink-0">
            <button onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Check size={14} /> {editingCourse ? 'Update' : 'Create'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryManagement({ categories, setCategories }: { categories: Category[]; setCategories: React.Dispatch<React.SetStateAction<Category[]>> }) {
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: '📁', subCategories: [{ id: '', name: '' }] });

  const openCreate = () => {
    setEditingCat(null);
    setForm({ name: '', icon: '📁', subCategories: [{ id: '', name: '' }] });
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditingCat(c);
    setForm({ name: c.name, icon: c.icon, subCategories: c.subCategories.length ? c.subCategories : [{ id: '', name: '' }] });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const validSubs = form.subCategories.filter(s => s.name.trim()).map(s => ({ id: s.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: s.name }));
    let saved: Category;
    if (editingCat) {
      saved = { ...editingCat, name: form.name, icon: form.icon, subCategories: validSubs };
      setCategories(prev => prev.map(c => c.id === editingCat.id ? saved : c));
    } else {
      saved = { id: `cat-${Date.now()}`, name: form.name, icon: form.icon, subCategories: validSubs };
      setCategories(prev => [...prev, saved]);
    }
    setShowModal(false);
    try { await fetch('/api/academy/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saved) }); } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    setCategories(prev => prev.filter(c => c.id !== id));
    try { await fetch('/api/academy/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Categories & Sub-Categories</h3>
        <button onClick={openCreate} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Plus size={14} /> New Category</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <h4 className="text-sm font-black text-slate-900">{c.name}</h4>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="space-y-1.5">
              {c.subCategories.map(sc => (
                <div key={sc.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-bold text-slate-600">
                  <ChevronRight size={12} className="text-slate-300" /> {sc.name}
                </div>
              ))}
              {c.subCategories.length === 0 && <p className="text-[10px] text-slate-400 font-bold italic">No sub-categories</p>}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black uppercase tracking-tight">{editingCat ? 'Edit Category' : 'Create Category'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-5">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Icon</label>
                  <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-2xl text-center focus:border-indigo-400 outline-none" />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Category Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Sub-Categories</label>
                {form.subCategories.map((sc, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input value={sc.name} onChange={e => { const subs = [...form.subCategories]; subs[i] = { ...subs[i], name: e.target.value }; setForm({ ...form, subCategories: subs }); }} className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-400 outline-none" placeholder={`Sub-category ${i + 1}`} />
                    {form.subCategories.length > 1 && <button onClick={() => setForm({ ...form, subCategories: form.subCategories.filter((_, j) => j !== i) })} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><X size={14} /></button>}
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, subCategories: [...form.subCategories, { id: '', name: '' }] })} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Add Sub-Category</button>
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Check size={14} /> {editingCat ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CurriculumBuilder({ courses, sections, setSections }: { courses: Course[]; sections: Section[]; setSections: React.Dispatch<React.SetStateAction<Section[]>> }) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ sectionId: string; lesson: Lesson | null }>({ sectionId: '', lesson: null });
  const [sectionForm, setSectionForm] = useState({ title: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', type: 'video' as Lesson['type'], content: '', duration: 0 });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const courseSections = useMemo(() => sections.filter(s => s.courseId === selectedCourseId).sort((a, b) => a.order - b.order), [sections, selectedCourseId]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const openCreateSection = () => {
    setEditingSection(null);
    setSectionForm({ title: '' });
    setShowSectionModal(true);
  };

  const openEditSection = (s: Section) => {
    setEditingSection(s);
    setSectionForm({ title: s.title });
    setShowSectionModal(true);
  };

  const saveSection = () => {
    if (!sectionForm.title.trim()) return;
    if (editingSection) {
      setSections(prev => prev.map(s => s.id === editingSection.id ? { ...s, title: sectionForm.title } : s));
    } else {
      const newSection: Section = { id: `sec-${Date.now()}`, courseId: selectedCourseId, title: sectionForm.title, order: courseSections.length + 1, lessons: [] };
      setSections(prev => [...prev, newSection]);
      setExpandedSections(prev => new Set(prev).add(newSection.id));
    }
    setShowSectionModal(false);
  };

  const deleteSection = (id: string) => {
    if (!confirm('Delete this section and all its lessons?')) return;
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const idx = courseSections.findIndex(s => s.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === courseSections.length - 1)) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    setSections(prev => prev.map(s => {
      if (s.id === courseSections[idx].id) return { ...s, order: courseSections[swapIdx].order };
      if (s.id === courseSections[swapIdx].id) return { ...s, order: courseSections[idx].order };
      return s;
    }));
  };

  const openCreateLesson = (sectionId: string) => {
    setEditingLesson({ sectionId, lesson: null });
    setLessonForm({ title: '', type: 'video', content: '', duration: 0 });
    setShowLessonModal(true);
  };

  const openEditLesson = (sectionId: string, lesson: Lesson) => {
    setEditingLesson({ sectionId, lesson });
    setLessonForm({ title: lesson.title, type: lesson.type, content: lesson.content, duration: lesson.duration });
    setShowLessonModal(true);
  };

  const saveLesson = () => {
    if (!lessonForm.title.trim()) return;
    const { sectionId, lesson } = editingLesson;
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      if (lesson) {
        return { ...s, lessons: s.lessons.map(l => l.id === lesson.id ? { ...l, ...lessonForm } : l) };
      }
      const newLesson: Lesson = { id: `les-${Date.now()}`, ...lessonForm, order: s.lessons.length + 1 };
      return { ...s, lessons: [...s.lessons, newLesson] };
    }));
    setShowLessonModal(false);
  };

  const deleteLesson = (sectionId: string, lessonId: string) => {
    if (!confirm('Delete this lesson?')) return;
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, lessons: s.lessons.filter(l => l.id !== lessonId) } : s));
  };

  const moveLesson = (sectionId: string, lessonId: string, direction: 'up' | 'down') => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const sorted = [...s.lessons].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(l => l.id === lessonId);
      if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === sorted.length - 1)) return s;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      const updated = sorted.map((l, i) => {
        if (i === idx) return { ...l, order: sorted[swapIdx].order };
        if (i === swapIdx) return { ...l, order: sorted[idx].order };
        return l;
      });
      return { ...s, lessons: updated };
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className="border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none min-w-[250px]">
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <button onClick={openCreateSection} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Plus size={14} /> Add Section</button>
      </div>

      {courseSections.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <Layers size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-sm font-bold text-slate-400">No sections yet. Add your first section to start building the curriculum.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courseSections.map((section, sIdx) => (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200 cursor-pointer" onClick={() => toggleSection(section.id)}>
                <div className="flex flex-col gap-0.5">
                  <button onClick={e => { e.stopPropagation(); moveSection(section.id, 'up'); }} className="p-0.5 hover:bg-white rounded text-slate-400 hover:text-indigo-600 transition-all disabled:opacity-30" disabled={sIdx === 0}><ArrowUp size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); moveSection(section.id, 'down'); }} className="p-0.5 hover:bg-white rounded text-slate-400 hover:text-indigo-600 transition-all disabled:opacity-30" disabled={sIdx === courseSections.length - 1}><ArrowDown size={12} /></button>
                </div>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${expandedSections.has(section.id) ? 'rotate-90' : ''}`} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-800">Section {sIdx + 1}: {section.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{section.lessons.length} lesson{section.lessons.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); openEditSection(section); }} className="p-1.5 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><Edit2 size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); deleteSection(section.id); }} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>

              {expandedSections.has(section.id) && (
                <div className="p-4 space-y-2">
                  {section.lessons.sort((a, b) => a.order - b.order).map((lesson, lIdx) => (
                    <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveLesson(section.id, lesson.id, 'up')} className="p-0.5 hover:bg-white rounded text-slate-300 hover:text-indigo-600 transition-all" disabled={lIdx === 0}><ArrowUp size={10} /></button>
                        <button onClick={() => moveLesson(section.id, lesson.id, 'down')} className="p-0.5 hover:bg-white rounded text-slate-300 hover:text-indigo-600 transition-all" disabled={lIdx === section.lessons.length - 1}><ArrowDown size={10} /></button>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-indigo-500">{LESSON_TYPE_ICONS[lesson.type]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{lesson.title}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lesson.type}{lesson.duration > 0 ? ` · ${lesson.duration} min` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditLesson(section.id, lesson)} className="p-1.5 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><Edit2 size={12} /></button>
                        <button onClick={() => deleteLesson(section.id, lesson.id)} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => openCreateLesson(section.id)} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-1.5">
                    <Plus size={12} /> Add Lesson
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSectionModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight">{editingSection ? 'Edit Section' : 'Add Section'}</h3>
              <button onClick={() => setShowSectionModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-8">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Section Title *</label>
              <input value={sectionForm.title} onChange={e => setSectionForm({ title: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowSectionModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={saveSection} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Check size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {showLessonModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight">{editingLesson.lesson ? 'Edit Lesson' : 'Add Lesson'}</h3>
              <button onClick={() => setShowLessonModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Lesson Title *</label>
                <input value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Type</label>
                  <select value={lessonForm.type} onChange={e => setLessonForm({ ...lessonForm, type: e.target.value as Lesson['type'] })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                    <option value="video">Video URL</option>
                    <option value="text">Text / HTML</option>
                    <option value="document">Document Upload</option>
                    <option value="image">Image</option>
                    <option value="audio">Audio</option>
                    <option value="iframe">iFrame Embed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Duration (min)</label>
                  <input type="number" value={lessonForm.duration} onChange={e => setLessonForm({ ...lessonForm, duration: parseInt(e.target.value) || 0 })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                  {lessonForm.type === 'video' ? 'Video URL' : lessonForm.type === 'text' ? 'Content (HTML)' : lessonForm.type === 'iframe' ? 'Embed URL' : 'File Path / URL'}
                </label>
                {lessonForm.type === 'text' ? (
                  <textarea value={lessonForm.content} onChange={e => setLessonForm({ ...lessonForm, content: e.target.value })} rows={5} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none resize-none font-mono" />
                ) : (
                  <input value={lessonForm.content} onChange={e => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder={lessonForm.type === 'video' ? 'https://youtube.com/...' : lessonForm.type === 'iframe' ? 'https://embed.example.com/...' : 'filename.pdf'} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                )}
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowLessonModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={saveLesson} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Check size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizManager({ courses, quizzes, setQuizzes }: { courses: Course[]; quizzes: Quiz[]; setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>> }) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizForm, setQuizForm] = useState({ title: '', passMarks: 70, timeLimit: 30 });
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{ quizId: string; question: Question | null }>({ quizId: '', question: null });
  const [questionForm, setQuestionForm] = useState({ type: 'mcq' as Question['type'], text: '', options: ['', '', '', ''], correctAnswer: '', marks: 10 });

  const courseQuizzes = useMemo(() => quizzes.filter(q => q.courseId === selectedCourseId), [quizzes, selectedCourseId]);

  const openCreateQuiz = () => {
    setEditingQuiz(null);
    setQuizForm({ title: '', passMarks: 70, timeLimit: 30 });
    setShowQuizModal(true);
  };

  const openEditQuiz = (q: Quiz) => {
    setEditingQuiz(q);
    setQuizForm({ title: q.title, passMarks: q.passMarks, timeLimit: q.timeLimit });
    setShowQuizModal(true);
  };

  const saveQuiz = () => {
    if (!quizForm.title.trim()) return;
    if (editingQuiz) {
      setQuizzes(prev => prev.map(q => q.id === editingQuiz.id ? { ...q, ...quizForm } : q));
    } else {
      setQuizzes(prev => [...prev, { id: `quiz-${Date.now()}`, courseId: selectedCourseId, ...quizForm, questions: [] }]);
    }
    setShowQuizModal(false);
  };

  const deleteQuiz = (id: string) => {
    if (!confirm('Delete this quiz?')) return;
    setQuizzes(prev => prev.filter(q => q.id !== id));
  };

  const openCreateQuestion = (quizId: string) => {
    setEditingQuestion({ quizId, question: null });
    setQuestionForm({ type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '', marks: 10 });
    setShowQuestionModal(true);
  };

  const openEditQuestion = (quizId: string, question: Question) => {
    setEditingQuestion({ quizId, question });
    setQuestionForm({ type: question.type, text: question.text, options: question.options.length ? question.options : ['', '', '', ''], correctAnswer: question.correctAnswer, marks: question.marks });
    setShowQuestionModal(true);
  };

  const saveQuestion = () => {
    if (!questionForm.text.trim()) return;
    const { quizId, question } = editingQuestion;
    const cleanOptions = questionForm.type === 'mcq' ? questionForm.options.filter(o => o.trim()) : questionForm.type === 'true-false' ? ['True', 'False'] : [];
    setQuizzes(prev => prev.map(q => {
      if (q.id !== quizId) return q;
      if (question) {
        return { ...q, questions: q.questions.map(qn => qn.id === question.id ? { ...qn, ...questionForm, options: cleanOptions } : qn) };
      }
      return { ...q, questions: [...q.questions, { id: `q-${Date.now()}`, ...questionForm, options: cleanOptions }] };
    }));
    setShowQuestionModal(false);
  };

  const deleteQuestion = (quizId: string, questionId: string) => {
    if (!confirm('Delete this question?')) return;
    setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, questions: q.questions.filter(qn => qn.id !== questionId) } : q));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className="border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none min-w-[250px]">
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button onClick={openCreateQuiz} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Plus size={14} /> New Quiz</button>
      </div>

      {courseQuizzes.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <ListChecks size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-sm font-bold text-slate-400">No quizzes for this course yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courseQuizzes.map(quiz => (
            <div key={quiz.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-black text-slate-800">{quiz.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''} · Pass: {quiz.passMarks}% · Time: {quiz.timeLimit} min · Total: {quiz.questions.reduce((s, q) => s + q.marks, 0)} marks
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditQuiz(quiz)} className="p-1.5 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><Edit2 size={14} /></button>
                  <button onClick={() => deleteQuiz(quiz.id)} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {quiz.questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group">
                    <span className="text-[10px] font-black text-slate-300 w-6 text-center">{i + 1}</span>
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-indigo-500">{QUESTION_TYPE_ICONS[q.type]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{q.text}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{q.type.replace('-', ' ')} · {q.marks} marks</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditQuestion(quiz.id, q)} className="p-1.5 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-all"><Edit2 size={12} /></button>
                      <button onClick={() => deleteQuestion(quiz.id, q.id)} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => openCreateQuestion(quiz.id)} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-1.5">
                  <Plus size={12} /> Add Question
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showQuizModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight">{editingQuiz ? 'Edit Quiz' : 'Create Quiz'}</h3>
              <button onClick={() => setShowQuizModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Quiz Title *</label>
                <input value={quizForm.title} onChange={e => setQuizForm({ ...quizForm, title: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Pass Marks (%)</label>
                  <input type="number" value={quizForm.passMarks} onChange={e => setQuizForm({ ...quizForm, passMarks: parseInt(e.target.value) || 0 })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Time Limit (min)</label>
                  <input type="number" value={quizForm.timeLimit} onChange={e => setQuizForm({ ...quizForm, timeLimit: parseInt(e.target.value) || 0 })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                </div>
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowQuizModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={saveQuiz} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Check size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {showQuestionModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black uppercase tracking-tight">{editingQuestion.question ? 'Edit Question' : 'Add Question'}</h3>
              <button onClick={() => setShowQuestionModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Question Type</label>
                <select value={questionForm.type} onChange={e => setQuestionForm({ ...questionForm, type: e.target.value as Question['type'] })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                  <option value="mcq">Multiple Choice</option>
                  <option value="true-false">True / False</option>
                  <option value="fill-blank">Fill in the Blank</option>
                  <option value="short-answer">Short Answer</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Question Text *</label>
                <textarea value={questionForm.text} onChange={e => setQuestionForm({ ...questionForm, text: e.target.value })} rows={3} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none resize-none" />
              </div>
              {questionForm.type === 'mcq' && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Options</label>
                  {questionForm.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black text-slate-400 w-6 text-center">{String.fromCharCode(65 + i)}</span>
                      <input value={o} onChange={e => { const opts = [...questionForm.options]; opts[i] = e.target.value; setQuestionForm({ ...questionForm, options: opts }); }} className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-400 outline-none" placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                      {questionForm.options.length > 2 && <button onClick={() => setQuestionForm({ ...questionForm, options: questionForm.options.filter((_, j) => j !== i) })} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><X size={14} /></button>}
                    </div>
                  ))}
                  {questionForm.options.length < 6 && (
                    <button onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, ''] })} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Add Option</button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Correct Answer</label>
                  {questionForm.type === 'true-false' ? (
                    <select value={questionForm.correctAnswer} onChange={e => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                      <option value="">Select</option>
                      <option value="True">True</option>
                      <option value="False">False</option>
                    </select>
                  ) : (
                    <input value={questionForm.correctAnswer} onChange={e => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" placeholder={questionForm.type === 'mcq' ? 'Enter matching option text' : 'Expected answer'} />
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Marks</label>
                  <input type="number" value={questionForm.marks} onChange={e => setQuestionForm({ ...questionForm, marks: parseInt(e.target.value) || 0 })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                </div>
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowQuestionModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={saveQuestion} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Check size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentManagement({ students, enrollments, setEnrollments, courses }: { students: Student[]; enrollments: Enrollment[]; setEnrollments: React.Dispatch<React.SetStateAction<Enrollment[]>>; courses: Course[] }) {
  const [search, setSearch] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ studentId: '', courseId: '' });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const filtered = useMemo(() => students.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  }), [students, search]);

  const handleEnroll = () => {
    if (!enrollForm.studentId || !enrollForm.courseId) return;
    const student = students.find(s => s.id === enrollForm.studentId);
    const course = courses.find(c => c.id === enrollForm.courseId);
    if (!student || !course) return;
    const existing = enrollments.find(e => e.studentId === enrollForm.studentId && e.courseId === enrollForm.courseId);
    if (existing) { alert('Student is already enrolled in this course.'); return; }
    setEnrollments(prev => [...prev, {
      id: `enr-${Date.now()}`, studentId: student.id, studentName: student.name,
      courseId: course.id, courseName: course.title, progress: 0,
      enrolledAt: new Date().toISOString().split('T')[0], completedAt: null
    }]);
    setShowEnrollModal(false);
    setEnrollForm({ studentId: '', courseId: '' });
  };

  const studentEnrollments = selectedStudent ? enrollments.filter(e => e.studentId === selectedStudent.id) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..." className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none" />
        </div>
        <button onClick={() => setShowEnrollModal(true)} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><UserPlus size={14} /> Manual Enroll</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Enrolled Students</h3>
          {filtered.map(s => (
            <div key={s.id} onClick={() => setSelectedStudent(s)} className={`flex items-center gap-4 p-4 bg-white rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${selectedStudent?.id === s.id ? 'border-indigo-400 shadow-md' : 'border-slate-200'}`}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white text-sm font-black">{s.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                <p className="text-[10px] text-slate-400 font-bold">{s.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-slate-900">{s.progress}%</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.enrolledCourses} courses</p>
              </div>
              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${s.progress}%` }} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
              <Users size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-400">No students found</p>
            </div>
          )}
        </div>

        <div>
          {selectedStudent ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white text-xl font-black mx-auto mb-3">{selectedStudent.name.charAt(0)}</div>
                <h4 className="text-sm font-black text-slate-900">{selectedStudent.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold">{selectedStudent.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-indigo-600">{selectedStudent.enrolledCourses}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enrolled</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-emerald-600">{selectedStudent.completedCourses}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                </div>
              </div>
              <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Enrollment History</h5>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {studentEnrollments.map(e => (
                  <div key={e.id} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs font-bold text-slate-700 truncate">{e.courseName}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-bold text-slate-400">{e.enrolledAt}</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${e.completedAt ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {e.completedAt ? 'Completed' : `${e.progress}%`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full rounded-full ${e.completedAt ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${e.progress}%` }} />
                    </div>
                  </div>
                ))}
                {studentEnrollments.length === 0 && <p className="text-[10px] text-slate-400 font-bold italic text-center py-4">No enrollments</p>}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center sticky top-6">
              <Eye size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-400">Select a student to view details</p>
            </div>
          )}
        </div>
      </div>

      {showEnrollModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight">Manual Enrollment</h3>
              <button onClick={() => setShowEnrollModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Student</label>
                <select value={enrollForm.studentId} onChange={e => setEnrollForm({ ...enrollForm, studentId: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                  <option value="">Select Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Course</label>
                <select value={enrollForm.courseId} onChange={e => setEnrollForm({ ...enrollForm, courseId: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-indigo-400 outline-none">
                  <option value="">Select Course</option>
                  {courses.filter(c => c.status === 'published').map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowEnrollModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={handleEnroll} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><UserPlus size={14} /> Enroll</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BadgeManagement({ badges, setBadges }: { badges: Badge[]; setBadges: React.Dispatch<React.SetStateAction<Badge[]>> }) {
  const [showModal, setShowModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [form, setForm] = useState({ title: '', description: '', icon: '🏅', criteria: '' });

  const openCreate = () => {
    setEditingBadge(null);
    setForm({ title: '', description: '', icon: '🏅', criteria: '' });
    setShowModal(true);
  };

  const openEdit = (b: Badge) => {
    setEditingBadge(b);
    setForm({ title: b.title, description: b.description, icon: b.icon, criteria: b.criteria });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingBadge) {
      setBadges(prev => prev.map(b => b.id === editingBadge.id ? { ...b, ...form } : b));
    } else {
      setBadges(prev => [...prev, { id: `bdg-${Date.now()}`, ...form, awardCount: 0 }]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this badge?')) return;
    setBadges(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Achievement Badges</h3>
        <button onClick={openCreate} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Plus size={14} /> New Badge</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {badges.map(b => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all group text-center">
            <div className="text-5xl mb-4">{b.icon}</div>
            <h4 className="text-sm font-black text-slate-900 mb-1">{b.title}</h4>
            <p className="text-xs text-slate-500 mb-3 line-clamp-2">{b.description}</p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Award size={14} className="text-amber-500" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{b.awardCount} awarded</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Criteria</p>
              <p className="text-xs text-slate-600 font-bold">{b.criteria}</p>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(b)} className="flex-1 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1"><Edit2 size={12} /> Edit</button>
              <button onClick={() => handleDelete(b.id)} className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-all"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {badges.length === 0 && (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <Trophy size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-sm font-bold text-slate-400">No badges created yet</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight">{editingBadge ? 'Edit Badge' : 'Create Badge'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Icon</label>
                  <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-2xl text-center focus:border-indigo-400 outline-none" />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Badge Title *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Award Criteria</label>
                <textarea value={form.criteria} onChange={e => setForm({ ...form, criteria: e.target.value })} rows={2} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none resize-none" />
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Check size={14} /> {editingBadge ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AffiliateSettings {
  discount_percent: number;
  commission_percent: number;
  default_max_uses: number;
}

interface AffiliateCoupon {
  id: string;
  code: string;
  owner_id: string;
  owner_name: string;
  max_uses: number;
  current_uses: number;
  total_commission_earned: number;
  active: boolean;
  created_at: string;
}

interface AffiliateWallet {
  id: string;
  user_id: string;
  user_name?: string;
  balance: number;
  total_earned: number;
  last_payout?: number;
  last_payout_at?: string;
}

function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_session_token') || '';
}

function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'x-admin-token': getAdminToken(), ...extra };
}

function AffiliatesManagement() {
  const [settings, setSettings] = useState<AffiliateSettings>({ discount_percent: 10, commission_percent: 5, default_max_uses: 50 });
  const [settingsForm, setSettingsForm] = useState<AffiliateSettings>({ discount_percent: 10, commission_percent: 5, default_max_uses: 50 });
  const [savingSettings, setSavingSettings] = useState(false);
  const [coupons, setCoupons] = useState<AffiliateCoupon[]>([]);
  const [wallets, setWallets] = useState<AffiliateWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponSearch, setCouponSearch] = useState('');
  const [couponStatusFilter, setCouponStatusFilter] = useState('all');
  const [couponSort, setCouponSort] = useState<'uses_asc' | 'uses_desc' | 'commission_desc'>('uses_desc');
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [togglingCoupon, setTogglingCoupon] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [genOwnerId, setGenOwnerId] = useState('');
  const [genOwnerName, setGenOwnerName] = useState('');
  const [generatingCoupon, setGeneratingCoupon] = useState(false);
  const [genError, setGenError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes, wRes] = await Promise.all([
        fetch('/api/academy/affiliate-settings'),
        fetch('/api/academy/affiliate-coupons', { headers: adminHeaders() }),
        fetch('/api/academy/affiliate-wallet?all=true', { headers: adminHeaders() }),
      ]);
      const [sd, cd, wd] = await Promise.all([sRes.json(), cRes.json(), wRes.json()]);
      if (sd.settings) { setSettings(sd.settings); setSettingsForm(sd.settings); }
      setCoupons(cd.items || []);
      setWallets(wd.wallets || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch('/api/academy/affiliate-settings', { method: 'POST', headers: adminHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(settingsForm) });
      setSettings(settingsForm);
    } catch {}
    setSavingSettings(false);
  };

  const handleToggleCoupon = async (coupon: AffiliateCoupon) => {
    setTogglingCoupon(coupon.id);
    try {
      await fetch('/api/academy/affiliate-coupons', { method: 'PATCH', headers: adminHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: coupon.id, active: !coupon.active }) });
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: !c.active } : c));
    } catch {}
    setTogglingCoupon(null);
  };

  const handleMarkPaid = async (wallet: AffiliateWallet) => {
    setMarkingPaid(wallet.id);
    try {
      await fetch('/api/academy/affiliate-wallet', { method: 'PATCH', headers: adminHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ user_id: wallet.user_id, action: 'mark_paid' }) });
      setWallets(prev => prev.map(w => w.id === wallet.id ? { ...w, balance: 0, last_payout: w.balance } : w));
    } catch {}
    setMarkingPaid(null);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  };

  const handleGenerateCoupon = async () => {
    if (!genOwnerId.trim() || !genOwnerName.trim()) { setGenError('Student ID and full name are required'); return; }
    setGeneratingCoupon(true);
    setGenError('');
    try {
      const res = await fetch('/api/academy/affiliate-coupons', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ owner_id: genOwnerId.trim(), owner_name: genOwnerName.trim(), max_uses: settingsForm.default_max_uses || 50 }),
      });
      const data = await res.json();
      if (data.coupon) {
        setCoupons(prev => [data.coupon, ...prev.filter(c => c.owner_id !== data.coupon.owner_id)]);
        setGenOwnerId('');
        setGenOwnerName('');
      } else {
        setGenError(data.error || 'Failed to generate coupon');
      }
    } catch { setGenError('Network error'); }
    setGeneratingCoupon(false);
  };

  const filteredCoupons = useMemo(() => {
    let result = coupons.filter(c => {
      const q = couponSearch.toLowerCase();
      const matchQ = !q || c.code.toLowerCase().includes(q) || c.owner_name.toLowerCase().includes(q);
      const status: 'Active' | 'Exhausted' | 'Disabled' = c.active ? (c.current_uses >= c.max_uses ? 'Exhausted' : 'Active') : 'Disabled';
      const matchStatus = couponStatusFilter === 'all' || status.toLowerCase() === couponStatusFilter;
      return matchQ && matchStatus;
    });
    if (couponSort === 'uses_asc') result = [...result].sort((a, b) => a.current_uses - b.current_uses);
    else if (couponSort === 'uses_desc') result = [...result].sort((a, b) => b.current_uses - a.current_uses);
    else if (couponSort === 'commission_desc') result = [...result].sort((a, b) => (b.total_commission_earned || 0) - (a.total_commission_earned || 0));
    return result;
  }, [coupons, couponSearch, couponStatusFilter, couponSort]);

  const walletsWithBalance = wallets.filter(w => w.balance > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Share2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Affiliate Settings</h3>
            <p className="text-[10px] text-slate-400 font-bold">Configure discount and commission rates</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Discount % for Referees</label>
            <div className="relative">
              <input
                type="number" min={0} max={100}
                value={settingsForm.discount_percent}
                onChange={e => setSettingsForm(p => ({ ...p, discount_percent: Number(e.target.value) }))}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">%</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1">New students get this % off</p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Commission % for Owners</label>
            <div className="relative">
              <input
                type="number" min={0} max={100}
                value={settingsForm.commission_percent}
                onChange={e => setSettingsForm(p => ({ ...p, commission_percent: Number(e.target.value) }))}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">%</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Coupon owners earn this % as commission</p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Default Max Uses / Coupon</label>
            <input
              type="number" min={1}
              value={settingsForm.default_max_uses}
              onChange={e => setSettingsForm(p => ({ ...p, default_max_uses: Number(e.target.value) }))}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none"
            />
            <p className="text-[10px] text-slate-400 font-bold mt-1">How many times a coupon can be used</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveSettings} disabled={savingSettings} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50">
            {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Settings
          </button>
          {settings.discount_percent !== settingsForm.discount_percent || settings.commission_percent !== settingsForm.commission_percent || settings.default_max_uses !== settingsForm.default_max_uses ? (
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Unsaved changes</span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12} /> Saved</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
            <Plus size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Generate Referral Code for Student</h3>
            <p className="text-[10px] text-slate-400 font-bold">Only eligible students with paid enrolments can receive a referral code</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text" placeholder="Student User ID"
            value={genOwnerId} onChange={e => setGenOwnerId(e.target.value)}
            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-violet-400 outline-none"
          />
          <input
            type="text" placeholder="Student Full Name"
            value={genOwnerName} onChange={e => setGenOwnerName(e.target.value)}
            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-violet-400 outline-none"
          />
          <button
            onClick={handleGenerateCoupon}
            disabled={generatingCoupon || !genOwnerId.trim() || !genOwnerName.trim()}
            className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {generatingCoupon ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Generate
          </button>
        </div>
        {genError && <p className="text-[11px] text-red-600 font-bold mt-2">{genError}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <BadgeCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Coupon Codes</h3>
              <p className="text-[10px] text-slate-400 font-bold">{coupons.length} total coupons</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input value={couponSearch} onChange={e => setCouponSearch(e.target.value)} placeholder="Search code or owner..." className="pl-9 pr-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-400 outline-none w-44" />
            </div>
            <select value={couponStatusFilter} onChange={e => setCouponStatusFilter(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white focus:border-indigo-400 outline-none">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="exhausted">Exhausted</option>
              <option value="disabled">Disabled</option>
            </select>
            <select value={couponSort} onChange={e => setCouponSort(e.target.value as typeof couponSort)} className="border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white focus:border-indigo-400 outline-none">
              <option value="uses_desc">Most Used</option>
              <option value="uses_asc">Least Used</option>
              <option value="commission_desc">Most Commission</option>
            </select>
            <button onClick={fetchAll} className="p-2 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <RefreshCw size={14} className="text-slate-400" />
            </button>
          </div>
        </div>

        {filteredCoupons.length === 0 ? (
          <div className="py-12 text-center">
            <BadgeCheck size={32} className="mx-auto text-slate-200 mb-3" />
            <p className="text-xs font-bold text-slate-400">No coupons found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Owner</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Uses</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Commission Earned</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCoupons.map(coupon => {
                  const isExhausted = coupon.current_uses >= coupon.max_uses;
                  const statusLabel = !coupon.active ? 'Disabled' : isExhausted ? 'Exhausted' : 'Active';
                  const statusClass = !coupon.active ? 'bg-slate-100 text-slate-500' : isExhausted ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                  const usePct = Math.min(100, Math.round((coupon.current_uses / Math.max(coupon.max_uses, 1)) * 100));
                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50/60 transition-all">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 tracking-widest text-sm">{coupon.code}</span>
                          <button
                            onClick={() => handleCopy(coupon.code, coupon.id)}
                            className="p-1 rounded-lg hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600"
                          >
                            {copied === coupon.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-slate-700">{coupon.owner_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[60px] max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isExhausted ? 'bg-amber-400' : 'bg-indigo-400'}`} style={{ width: `${usePct}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-slate-500">{coupon.current_uses}/{coupon.max_uses}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                          <IndianRupee size={11} />{(coupon.total_commission_earned || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusClass}`}>{statusLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleCoupon(coupon)}
                          disabled={togglingCoupon === coupon.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${coupon.active ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                        >
                          {togglingCoupon === coupon.id ? <Loader2 size={11} className="animate-spin" /> : coupon.active ? <ToggleLeft size={11} /> : <ToggleRight size={11} />}
                          {coupon.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Wallet size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Affiliate Payouts</h3>
            <p className="text-[10px] text-slate-400 font-bold">{walletsWithBalance.length} pending payouts</p>
          </div>
        </div>

        {walletsWithBalance.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet size={32} className="mx-auto text-slate-200 mb-3" />
            <p className="text-xs font-bold text-slate-400">No pending payouts</p>
            <p className="text-[10px] text-slate-300 font-bold mt-1">All affiliate wallets have zero balance</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending Balance</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Earned</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {walletsWithBalance.map(wallet => (
                  <tr key={wallet.id} className="hover:bg-slate-50/60 transition-all">
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-800">{wallet.user_name || wallet.user_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-black text-emerald-700 flex items-center gap-1">
                        <IndianRupee size={13} />{wallet.balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <IndianRupee size={11} />{(wallet.total_earned || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleMarkPaid(wallet)}
                        disabled={markingPaid === wallet.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {markingPaid === wallet.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Mark Paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Content (Tips + News) management ────────────────────────────────────
// Lightweight side-by-side CRUD for the Daily Food-Safety Tips carousel
// and Food Safety News grid that power the public landing page. Each
// list is independent; both write to JSONB-backed admin endpoints
// (/api/academy/safety-tips, /api/academy/news-posts).

// Hindi-variant payload mirrors the public landing/news types: any
// missing field falls back to the canonical English value at render
// time. We only persist non-empty values so unilingual rows stay clean.
type AdminContentLang = 'en' | 'hi';

interface TipTranslations {
  hi?: {
    title?: string;
    category?: string;
    excerpt?: string;
    body?: string;
    cta_headline?: string;
    cta_button_label?: string;
    auditor_note?: string;
  };
}

interface NewsTranslations {
  hi?: { title?: string; category?: string; excerpt?: string; body?: string };
}

interface SafetyTipRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  // Big in-page hero / home-page card image (current behavior).
  cover_image: string;
  // Smaller, hook-style image used ONLY in social-share previews
  // (OpenGraph / Twitter card). Keeping it separate lets editors
  // upload a wider, scroll-stopping thumbnail without having to
  // change the in-page hero. Falls back to cover_image when blank.
  share_image: string;
  icon?: string;
  status: 'published' | 'draft';
  published_on: string;
  read_minutes: number;
  author?: string;
  related_course_id?: string;
  related_training_session_id?: string;
  fallback_training_session_ids?: string[];
  cta_headline?: string;
  cta_button_label?: string;
  // Editor-supplied callout shown in the "Expert Auditor Note" block
  // on the public tip detail page. Plain text — not HTML.
  auditor_note?: string;
  translations?: TipTranslations;
}

interface NewsPostRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  cover_image: string;
  published_on: string;
  read_minutes: number;
  status: 'published' | 'draft';
  author?: string;
  // Which column this post appears in on the public Live Intelligence
  // Feed. Defaults to 'industry' for back-compat with rows created
  // before the feed split.
  feed_group: 'regulatory' | 'industry';
  // Optional external source URL for Industry Trends rows. When set,
  // the public feed links straight to this URL (e.g. a publisher's
  // article) instead of the auto-generated Google News search.
  external_url?: string;
  // How this article delivers its body to the reader:
  //  • 'text' (default, legacy) — admin writes the body in the WYSIWYG
  //    editor and clicking the card opens our internal /news/<slug>
  //    reader.
  //  • 'link' — admin pastes an external URL and clicking the card
  //    routes through our /n/<token> share landing (training-ad
  //    interstitial → external publisher), the same flow used for
  //    Industry Trends. Lets editors curate any third-party link as
  //    a "news card" without writing the body, while still funneling
  //    visitors past the training advertisement first (Google News
  //    style).
  content_type?: 'text' | 'link';
  // True for rows auto-created by the live Google News pull
  // (/api/academy/google-news upserts each visible item into
  // academy_news_posts). Surfaced in the admin so editors can
  // tell at a glance which rows are auto-fed vs hand-curated, and
  // a quick "Hide" toggle flips status to 'draft' to deactivate
  // without deleting (which would only let the row reappear on
  // the next pull).
  auto_saved?: boolean;
  // When true, the post is rendered at the top of its feed column
  // on the public Live Intelligence Feed regardless of published_on.
  // Multiple pinned posts in the same column are still ordered by
  // published_on desc among themselves.
  pinned?: boolean;
  translations?: NewsTranslations;
}

const ADMIN_CONTENT_LANGUAGES: { code: AdminContentLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
];

const cleanTipTranslations = (tx?: TipTranslations): TipTranslations | undefined => {
  if (!tx?.hi) return undefined;
  const hi: NonNullable<TipTranslations['hi']> = {};
  if (tx.hi.title?.trim()) hi.title = tx.hi.title.trim();
  if (tx.hi.category?.trim()) hi.category = tx.hi.category.trim();
  if (tx.hi.excerpt?.trim()) hi.excerpt = tx.hi.excerpt.trim();
  if (tx.hi.body?.trim()) hi.body = tx.hi.body.trim();
  if (tx.hi.cta_headline?.trim()) hi.cta_headline = tx.hi.cta_headline.trim();
  if (tx.hi.cta_button_label?.trim()) hi.cta_button_label = tx.hi.cta_button_label.trim();
  if (tx.hi.auditor_note?.trim()) hi.auditor_note = tx.hi.auditor_note.trim();
  return Object.keys(hi).length ? { hi } : undefined;
};

const cleanNewsTranslations = (
  tx?: NewsTranslations,
): NewsTranslations | undefined => {
  if (!tx?.hi) return undefined;
  const hi: { title?: string; category?: string; excerpt?: string; body?: string } = {};
  if (tx.hi.title?.trim()) hi.title = tx.hi.title.trim();
  if (tx.hi.category?.trim()) hi.category = tx.hi.category.trim();
  if (tx.hi.excerpt?.trim()) hi.excerpt = tx.hi.excerpt.trim();
  if (tx.hi.body?.trim()) hi.body = tx.hi.body.trim();
  return Object.keys(hi).length ? { hi } : undefined;
};

// Article CATEGORY is a fixed two-option enum surfaced as a dropdown
// in the Edit article dialog. We normalize any legacy free-text value
// (e.g. "Regulation", "FSSAI Update") to one of the two canonical
// labels so existing rows continue to render in the correct Live
// Intelligence Feed column. We also honor a legacy feed_group of
// 'regulatory' so a post that was previously placed in the regulatory
// column stays there even when its old category text was something
// like "FSSAI Update" that doesn't match /regulat/.
type ArticleCategory = 'Regulatory' | 'General';
const normalizeArticleCategory = (
  rawCategory?: string,
  feedGroup?: string,
): ArticleCategory => {
  const v = (rawCategory || '').toLowerCase().trim();
  if (v.includes('regulat')) return 'Regulatory';
  if ((feedGroup || '').toLowerCase() === 'regulatory') return 'Regulatory';
  return 'General';
};
// Hindi labels for the same enum. Stored as the localized string in
// translations.hi.category so the public Hindi UI continues to render
// a Hindi label without needing app-level translation tables.
const HINDI_CATEGORY_LABEL: Record<ArticleCategory, string> = {
  Regulatory: 'विनियामक',
  General: 'सामान्य',
};
const normalizeHindiArticleCategory = (
  rawHindi: string | undefined,
  canonical: ArticleCategory,
): ArticleCategory => {
  const v = (rawHindi || '').trim();
  if (!v) return canonical;
  if (v === HINDI_CATEGORY_LABEL.Regulatory) return 'Regulatory';
  if (v === HINDI_CATEGORY_LABEL.General) return 'General';
  // Legacy free-text Hindi values (e.g. "विनियमन") fall back to the
  // canonical English category so the dropdown shows a sensible value.
  return canonical;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const todayIso = () => new Date().toISOString().slice(0, 10);

function ContentManagement() {
  const [tips, setTips] = useState<SafetyTipRow[]>([]);
  const [news, setNews] = useState<NewsPostRow[]>([]);
  const [loadingTips, setLoadingTips] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  // Per-article click counts (post id -> count) and per-column totals
  // sourced from /api/academy/news-clicks. Lets editors see which Live
  // Intelligence Feed rows are pulling traffic without leaving the
  // admin.
  const [newsClickCounts, setNewsClickCounts] = useState<Record<string, number>>({});
  const [newsClickTotals, setNewsClickTotals] = useState<{ regulatory: number; industry: number }>({
    regulatory: 0,
    industry: 0,
  });
  const [editingTip, setEditingTip] = useState<SafetyTipRow | null>(null);
  const [editingPost, setEditingPost] = useState<NewsPostRow | null>(null);
  const [tipLang, setTipLang] = useState<AdminContentLang>('en');
  const [postLang, setPostLang] = useState<AdminContentLang>('en');
  // ── Quick-add news link state ────────────────────────────────────────
  // Streamlined flow for curating Google-News-style headlines: paste a
  // URL, the server pre-fills headline / excerpt / thumbnail from the
  // publisher page, the editor confirms and saves. Skips the full New
  // Article modal entirely so each Industry-column post takes one paste
  // and one click.
  const [quickLinkOpen, setQuickLinkOpen] = useState(false);
  const [quickLinkUrl, setQuickLinkUrl] = useState('');
  const [quickLinkFetching, setQuickLinkFetching] = useState(false);
  const [quickLinkError, setQuickLinkError] = useState('');
  const [quickLinkSaving, setQuickLinkSaving] = useState(false);
  const [quickLinkPreview, setQuickLinkPreview] = useState<{
    title: string;
    excerpt: string;
    image: string;
    publisher: string;
    finalUrl: string;
  } | null>(null);
  const [quickLinkPinned, setQuickLinkPinned] = useState(false);
  const [quickLinkCategory, setQuickLinkCategory] =
    useState<'General' | 'Regulatory'>('General');
  // ── Live Google News feed (preview inside admin) ─────────────────────
  // Same feed the public Industry Trends column shows. Editors can
  // see what's currently being pulled and one-click "Save" any item
  // into academy_news_posts (so it gets pinned/curated alongside
  // hand-written articles instead of disappearing on the next cache
  // refresh).
  type LiveNewsItem = {
    id: string;
    title: string;
    link: string;
    source: string;
    source_domain: string;
    image: string;
    published_on: string;
    excerpt: string;
  };
  const [liveNews, setLiveNews] = useState<LiveNewsItem[]>([]);
  const [liveNewsLoading, setLiveNewsLoading] = useState(true);
  const [liveNewsError, setLiveNewsError] = useState('');
  const [liveNewsSavingId, setLiveNewsSavingId] = useState('');
  const [liveNewsExpanded, setLiveNewsExpanded] = useState(true);
  const [trainingOptions, setTrainingOptions] = useState<
    Array<{
      id: string;
      topic?: string;
      subTopic?: string;
      description?: string;
      date?: string;
      mode?: string;
      status?: string;
      isActive?: boolean;
      registrationExpiryDate?: string;
    }>
  >([]);
  const [courseOptions, setCourseOptions] = useState<
    Array<{ id: string; title?: string; status?: string }>
  >([]);
  const [tipTrainingFilter, setTipTrainingFilter] = useState('');
  const [tipCourseFilter, setTipCourseFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/training-calendar?public=1');
        const j = await r.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = (Array.isArray(j?.items) ? j.items : [])
          .filter((s: any) => {
            if (!s) return false;
            if (!s.date) return true;
            const ts = Date.parse(s.date);
            if (Number.isNaN(ts)) return true;
            return ts >= today.getTime();
          })
          .sort((a: any, b: any) => Date.parse(a.date || '') - Date.parse(b.date || ''));
        if (!cancelled) setTrainingOptions(upcoming);
      } catch {
        if (!cancelled) setTrainingOptions([]);
      }
    })();
    (async () => {
      try {
        const r = await fetch('/api/academy/courses?status=Active');
        const j = await r.json();
        if (!cancelled) setCourseOptions(Array.isArray(j?.items) ? j.items : []);
      } catch {
        if (!cancelled) setCourseOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editingTip) {
      setTipLang('en');
      setTipTrainingFilter('');
      setTipCourseFilter('');
    }
  }, [editingTip?.id]);
  useEffect(() => {
    if (editingPost) setPostLang('en');
  }, [editingPost?.id]);

  const reloadTips = useCallback(async () => {
    setLoadingTips(true);
    try {
      const r = await fetch('/api/academy/safety-tips');
      const j = await r.json();
      const arr: SafetyTipRow[] = (Array.isArray(j?.items) ? j.items : []).map((t: any) => ({
        id: t.id,
        slug: t.slug || '',
        title: t.title || '',
        category: t.category || '',
        excerpt: t.excerpt || '',
        body: t.body || '',
        cover_image: t.cover_image || '',
        share_image: t.share_image || '',
        icon: t.icon || '',
        status: t.status === 'draft' ? 'draft' : 'published',
        published_on: t.published_on || todayIso(),
        read_minutes: typeof t.read_minutes === 'number' ? t.read_minutes : 2,
        author: t.author || '',
        related_course_id: typeof t.related_course_id === 'string' ? t.related_course_id : '',
        related_training_session_id:
          typeof t.related_training_session_id === 'string' ? t.related_training_session_id : '',
        fallback_training_session_ids: Array.isArray(t.fallback_training_session_ids)
          ? t.fallback_training_session_ids
              .filter((s: any) => typeof s === 'string' && s.trim())
              .slice(0, 3)
          : [],
        cta_headline: typeof t.cta_headline === 'string' ? t.cta_headline : '',
        cta_button_label: typeof t.cta_button_label === 'string' ? t.cta_button_label : '',
        auditor_note: typeof t.auditor_note === 'string' ? t.auditor_note : '',
        translations:
          t.translations && typeof t.translations === 'object'
            ? {
                hi: {
                  title: t.translations?.hi?.title || '',
                  category: t.translations?.hi?.category || '',
                  excerpt: t.translations?.hi?.excerpt || '',
                  body: t.translations?.hi?.body || '',
                  cta_headline: t.translations?.hi?.cta_headline || '',
                  cta_button_label: t.translations?.hi?.cta_button_label || '',
                  auditor_note: t.translations?.hi?.auditor_note || '',
                },
              }
            : undefined,
      }));
      setTips(arr);
    } catch {
      setTips([]);
    } finally {
      setLoadingTips(false);
    }
  }, []);

  const reloadNews = useCallback(async () => {
    setLoadingNews(true);
    try {
      const r = await fetch('/api/academy/news-posts');
      const j = await r.json();
      const arr: NewsPostRow[] = (Array.isArray(j?.items) ? j.items : []).map((n: any) => {
        // Normalize legacy free-text categories into the new
        // two-option enum so existing rows render correctly in the
        // admin dropdown and stay in their current Live Intelligence
        // Feed column.
        const canonical = normalizeArticleCategory(n.category, n.feed_group);
        const hiCanonical = normalizeHindiArticleCategory(
          n.translations?.hi?.category,
          canonical,
        );
        return {
          id: n.id,
          slug: n.slug || '',
          title: n.title || '',
          category: canonical,
          excerpt: n.excerpt || '',
          body: n.body || '',
          cover_image: n.cover_image || '',
          published_on: n.published_on || todayIso(),
          read_minutes: typeof n.read_minutes === 'number' ? n.read_minutes : 3,
          status: n.status === 'draft' ? 'draft' : 'published',
          author: n.author || '',
          feed_group: canonical === 'Regulatory' ? 'regulatory' : 'industry',
          external_url: typeof n.external_url === 'string' ? n.external_url : '',
          content_type:
            n.content_type === 'link'
              ? 'link'
              : typeof n.external_url === 'string' &&
                  n.external_url.trim().length > 0 &&
                  (!n.body || !String(n.body).trim())
                ? 'link'
                : 'text',
          pinned: n.pinned === true,
          auto_saved: n.auto_saved === true,
          translations:
            n.translations && typeof n.translations === 'object'
              ? {
                  hi: {
                    title: n.translations?.hi?.title || '',
                    category: HINDI_CATEGORY_LABEL[hiCanonical],
                    excerpt: n.translations?.hi?.excerpt || '',
                    body: n.translations?.hi?.body || '',
                  },
                }
              : undefined,
        };
      });
      // Latest articles first — superadmin requested newest-on-top.
      // Pinned posts still float to the very top (they're highlighted
      // on the public feed too); within each group we sort by
      // published_on descending so freshly-added rows surface
      // immediately. Falls back to 0 for unparseable dates so they
      // sink to the bottom rather than throwing off the order.
      arr.sort((a, b) => {
        if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) {
          return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        }
        const ta = Date.parse(a.published_on || '') || 0;
        const tb = Date.parse(b.published_on || '') || 0;
        return tb - ta;
      });
      setNews(arr);
    } catch {
      setNews([]);
    } finally {
      setLoadingNews(false);
    }
  }, []);

  const reloadLiveNews = useCallback(async () => {
    setLiveNewsLoading(true);
    setLiveNewsError('');
    try {
      const r = await fetch(
        `/api/academy/google-news?q=${encodeURIComponent('food safety')}&hl=mix&limit=20`,
      );
      if (!r.ok) {
        throw new Error(`Google News feed returned HTTP ${r.status}`);
      }
      const j = await r.json();
      if (j?.empty) {
        setLiveNews([]);
        setLiveNewsError(
          'No keywords configured yet. Add keywords in the “News Keywords” tab to start pulling Google News.',
        );
      } else {
        const arr: LiveNewsItem[] = (Array.isArray(j?.items) ? j.items : [])
          .filter((it: any) => it && typeof it.title === 'string' && typeof it.link === 'string')
          .map((it: any) => ({
            id: String(it.id || it.link),
            title: String(it.title || ''),
            link: String(it.link || ''),
            source: String(it.source || ''),
            source_domain: String(it.source_domain || ''),
            image: String(it.image || ''),
            published_on: String(it.published_on || ''),
            excerpt: String(it.excerpt || ''),
          }));
        setLiveNews(arr);
      }
    } catch (e) {
      console.error('reloadLiveNews failed', e);
      setLiveNewsError('Could not reach the Google News feed. Try Refresh.');
      setLiveNews([]);
    } finally {
      setLiveNewsLoading(false);
    }
  }, []);

  const saveLiveItem = async (item: LiveNewsItem) => {
    setLiveNewsSavingId(item.id);
    try {
      const id = `news-${Date.now()}`;
      const slug = slugify(item.title).slice(0, 80) || `link-${Date.now()}`;
      const publishedDate = (() => {
        const ts = item.published_on ? Date.parse(item.published_on) : NaN;
        if (Number.isNaN(ts)) return todayIso();
        return new Date(ts).toISOString().slice(0, 10);
      })();
      const payload = {
        id,
        slug,
        title: item.title,
        category: 'General',
        excerpt: item.excerpt || '',
        body: '',
        cover_image: item.image || '',
        published_on: publishedDate,
        read_minutes: 2,
        status: 'published' as const,
        author: item.source || '',
        feed_group: 'industry' as const,
        external_url: item.link,
        content_type: 'link' as const,
        pinned: false,
        translations: {
          hi: {
            title: '',
            category: HINDI_CATEGORY_LABEL['General'],
            excerpt: '',
            body: '',
          },
        },
      };
      const r = await fetch('/api/academy/news-posts', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({} as any));
        throw new Error(data?.error || `HTTP ${r.status}`);
      }
      reloadNews();
    } catch (e) {
      console.error('saveLiveItem failed', e);
      alert('Failed to save — admin sign-in required.');
    } finally {
      setLiveNewsSavingId('');
    }
  };

  const reloadNewsClicks = useCallback(async () => {
    try {
      const r = await fetch('/api/academy/news-clicks');
      const j = await r.json();
      const counts =
        j && typeof j.counts === 'object' && j.counts ? (j.counts as Record<string, number>) : {};
      const totalsRaw =
        j && typeof j.totals === 'object' && j.totals ? (j.totals as Record<string, number>) : {};
      setNewsClickCounts(counts);
      setNewsClickTotals({
        regulatory: Number(totalsRaw.regulatory || 0),
        industry: Number(totalsRaw.industry || 0),
      });
    } catch {
      setNewsClickCounts({});
      setNewsClickTotals({ regulatory: 0, industry: 0 });
    }
  }, []);

  useEffect(() => {
    reloadTips();
    reloadNews();
    reloadNewsClicks();
    reloadLiveNews();
  }, [reloadTips, reloadNews, reloadNewsClicks, reloadLiveNews]);

  // Canonicalise a URL so the “already saved” check survives trivial
  // variations (http vs https, trailing slash, www., utm/gclid/fbclid
  // tracking params). Without this, the same article surfaced via
  // Google News and saved via Quick Add would still show a Save button.
  const canonicaliseUrl = (raw: string): string => {
    const v = (raw || '').trim();
    if (!v) return '';
    try {
      const u = new URL(v);
      u.protocol = 'https:';
      u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
      u.hash = '';
      const drop = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'fbclid', 'mc_cid', 'mc_eid',
      ];
      for (const k of drop) u.searchParams.delete(k);
      let path = u.pathname.replace(/\/+$/, '') || '/';
      const search = u.searchParams.toString();
      return `${u.protocol}//${u.hostname}${path}${search ? `?${search}` : ''}`;
    } catch {
      return v.toLowerCase().replace(/\/+$/, '');
    }
  };

  // Set of canonicalised external URLs already saved as admin posts.
  // Lets us show a “Saved” pill on Live feed rows that are already
  // curated, so editors don't accidentally save the same article
  // twice (even if the URL was saved with different tracking params
  // or protocol).
  const savedExternalUrls = useMemo(() => {
    const s = new Set<string>();
    for (const n of news) {
      const u = canonicaliseUrl(n.external_url || '');
      if (u) s.add(u);
    }
    return s;
  // canonicaliseUrl is referentially stable in practice (defined above);
  // we intentionally only depend on `news` so the set rebuilds on data
  // change and not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news]);

  const newTip = () =>
    setEditingTip({
      id: `tip-${Date.now()}`,
      slug: '',
      title: '',
      category: '',
      excerpt: '',
      body: '',
      cover_image: '',
      share_image: '',
      icon: '',
      status: 'published',
      published_on: todayIso(),
      read_minutes: 2,
      author: '',
      related_course_id: '',
      related_training_session_id: '',
      fallback_training_session_ids: [],
      cta_headline: '',
      cta_button_label: '',
      auditor_note: '',
      translations: {
        hi: {
          title: '',
          category: '',
          excerpt: '',
          body: '',
          cta_headline: '',
          cta_button_label: '',
          auditor_note: '',
        },
      },
    });

  const newPost = () =>
    setEditingPost({
      id: `news-${Date.now()}`,
      slug: '',
      title: '',
      category: 'General',
      excerpt: '',
      body: '',
      cover_image: '',
      published_on: todayIso(),
      read_minutes: 3,
      status: 'published',
      author: '',
      feed_group: 'industry',
      external_url: '',
      content_type: 'text',
      pinned: false,
      translations: {
        hi: {
          title: '',
          category: HINDI_CATEGORY_LABEL.General,
          excerpt: '',
          body: '',
        },
      },
    });

  // ── Quick-add news link handlers ─────────────────────────────────────
  // Reset all transient state when the modal closes so a stale preview
  // from a previous URL never leaks into the next quick-add session.
  const closeQuickLink = () => {
    setQuickLinkOpen(false);
    setQuickLinkUrl('');
    setQuickLinkPreview(null);
    setQuickLinkError('');
    setQuickLinkFetching(false);
    setQuickLinkSaving(false);
    setQuickLinkPinned(false);
    setQuickLinkCategory('General');
  };

  // Hit the admin metadata endpoint and surface a friendly error if the
  // resolver can't reach the page (Google blocking us, page is JS-only,
  // 404, etc.). The editor can still tweak the preview by hand if some
  // fields come back empty.
  const fetchQuickLinkPreview = async () => {
    const url = quickLinkUrl.trim();
    if (!url) {
      setQuickLinkError('Paste a news link to fetch its headline.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setQuickLinkError('Link must start with http:// or https://');
      return;
    }
    setQuickLinkFetching(true);
    setQuickLinkError('');
    try {
      const r = await fetch('/api/academy/news-link-metadata', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url }),
      });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        setQuickLinkError(data?.error || `Could not read that page (HTTP ${r.status}).`);
        return;
      }
      setQuickLinkPreview({
        title: data?.title || '',
        excerpt: data?.excerpt || '',
        image: data?.image || '',
        publisher: data?.publisher || '',
        finalUrl: data?.finalUrl || url,
      });
      if (!data?.title && !data?.image) {
        setQuickLinkError(
          'Fetched the page but found no headline or thumbnail — you can fill these in below.',
        );
      }
    } catch (e) {
      console.error('fetchQuickLinkPreview failed', e);
      setQuickLinkError('Network error — please try again.');
    } finally {
      setQuickLinkFetching(false);
    }
  };

  const saveQuickLink = async () => {
    if (!quickLinkPreview) return;
    const title = quickLinkPreview.title.trim();
    if (!title) {
      setQuickLinkError('Headline is required — type one in if the page didn\'t supply one.');
      return;
    }
    // Prefer the resolver's canonical finalUrl over the pasted URL so we
    // never persist a Google-News intermediary (the public card would
    // open news.google.com instead of the actual publisher article).
    // Falls back to the pasted URL when the resolver couldn't follow
    // redirects (e.g. metadata fetch failed but the editor filled in
    // the headline manually).
    const resolvedFinalUrl = quickLinkPreview.finalUrl?.trim() || '';
    const pastedUrl = quickLinkUrl.trim();
    const linkUrl = resolvedFinalUrl || pastedUrl;
    if (!linkUrl) {
      setQuickLinkError('News link is required.');
      return;
    }
    setQuickLinkSaving(true);
    setQuickLinkError('');
    try {
      const id = `news-${Date.now()}`;
      const slug = slugify(title).slice(0, 80) || `link-${Date.now()}`;
      const feedGroup: 'regulatory' | 'industry' =
        quickLinkCategory === 'Regulatory' ? 'regulatory' : 'industry';
      const payload = {
        id,
        slug,
        title,
        category: quickLinkCategory,
        excerpt: quickLinkPreview.excerpt.trim(),
        body: '',
        cover_image: quickLinkPreview.image.trim(),
        published_on: todayIso(),
        read_minutes: 2,
        status: 'published' as const,
        author: quickLinkPreview.publisher.trim() || '',
        feed_group: feedGroup,
        external_url: linkUrl,
        content_type: 'link' as const,
        pinned: quickLinkPinned,
        translations: {
          hi: {
            title: '',
            category: HINDI_CATEGORY_LABEL[quickLinkCategory],
            excerpt: '',
            body: '',
          },
        },
      };
      const r = await fetch('/api/academy/news-posts', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({} as any));
        throw new Error(data?.error || `HTTP ${r.status}`);
      }
      closeQuickLink();
      reloadNews();
    } catch (e) {
      console.error('saveQuickLink failed', e);
      setQuickLinkError('Failed to publish — admin sign-in required.');
    } finally {
      setQuickLinkSaving(false);
    }
  };

  const saveTip = async () => {
    if (!editingTip) return;
    if (!editingTip.title.trim()) {
      alert('Tip title is required');
      return;
    }
    const slug = editingTip.slug.trim() || slugify(editingTip.title);
    try {
      const r = await fetch('/api/academy/safety-tips', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...editingTip,
          slug,
          related_course_id: editingTip.related_course_id?.trim() || undefined,
          related_training_session_id:
            editingTip.related_training_session_id?.trim() || undefined,
          fallback_training_session_ids:
            (editingTip.fallback_training_session_ids || [])
              .map((s) => (typeof s === 'string' ? s.trim() : ''))
              .filter((s) => !!s)
              .slice(0, 3).length
              ? (editingTip.fallback_training_session_ids || [])
                  .map((s) => (typeof s === 'string' ? s.trim() : ''))
                  .filter((s) => !!s)
                  .slice(0, 3)
              : undefined,
          cta_headline: editingTip.cta_headline?.trim() || undefined,
          cta_button_label: editingTip.cta_button_label?.trim() || undefined,
          auditor_note: editingTip.auditor_note?.trim() || undefined,
          translations: cleanTipTranslations(editingTip.translations),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setEditingTip(null);
      reloadTips();
    } catch (e) {
      console.error('saveTip failed', e);
      alert('Failed to save tip — admin sign-in required.');
    }
  };

  const deleteTip = async (id: string) => {
    if (!confirm('Delete this tip?')) return;
    try {
      const r = await fetch('/api/academy/safety-tips', {
        method: 'DELETE',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      reloadTips();
    } catch (e) {
      console.error(e);
      alert('Failed to delete tip — admin sign-in required.');
    }
  };

  const savePost = async () => {
    if (!editingPost) return;
    if (!editingPost.title.trim()) {
      alert('Article title is required');
      return;
    }
    const slug = editingPost.slug.trim() || slugify(editingPost.title);
    try {
      // CATEGORY drives Live Intelligence Feed placement now, so
       // derive feed_group from it on save. We still persist
       // feed_group for back-compat with consumers (analytics
       // endpoint, older callers) that read the legacy field.
      const canonicalCategory = normalizeArticleCategory(
        editingPost.category,
        editingPost.feed_group,
      );
      const derivedFeedGroup: 'regulatory' | 'industry' =
        canonicalCategory === 'Regulatory' ? 'regulatory' : 'industry';
      const r = await fetch('/api/academy/news-posts', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...editingPost,
          slug,
          category: canonicalCategory,
          feed_group: derivedFeedGroup,
          // Persist only meaningful external URLs so the public feed
          // can fall back to the auto-Google-News link when the field
          // is left blank by the editor.
          external_url:
            // Persist the URL for any LINK-mode post (regardless of
            // feed column), and for legacy industry rows where the
            // editor pasted a publisher override.
            (editingPost.content_type === 'link' ||
              derivedFeedGroup === 'industry') &&
            editingPost.external_url?.trim()
              ? editingPost.external_url.trim()
              : '',
          content_type: editingPost.content_type === 'link' ? 'link' : 'text',
          // LINK-mode posts have no body — strip whatever the editor
          // may have typed before flipping the toggle so the public
          // reader page can never be opened on a link-only article.
          body: editingPost.content_type === 'link' ? '' : editingPost.body,
          translations: cleanNewsTranslations(editingPost.translations),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setEditingPost(null);
      reloadNews();
    } catch (e) {
      console.error('savePost failed', e);
      alert('Failed to save article — admin sign-in required.');
    }
  };

  // Quick toggle: flip a news post between published <-> draft.
  // Used by the AUTO badge row's "Hide / Show" button so editors can
  // deactivate an auto-saved Google News item without opening the
  // full edit modal. We POST the entire row back so the API's
  // canonicalisation (slug, feed_group derivation, etc.) stays
  // consistent with the regular savePost path.
  const toggleNewsStatus = async (n: NewsPostRow) => {
    const nextStatus: 'published' | 'draft' =
      n.status === 'published' ? 'draft' : 'published';
    try {
      const canonicalCategory = normalizeArticleCategory(n.category, n.feed_group);
      const derivedFeedGroup: 'regulatory' | 'industry' =
        canonicalCategory === 'Regulatory' ? 'regulatory' : 'industry';
      const r = await fetch('/api/academy/news-posts', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...n,
          status: nextStatus,
          category: canonicalCategory,
          feed_group: derivedFeedGroup,
          translations: cleanNewsTranslations(n.translations),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      reloadNews();
    } catch (e) {
      console.error('toggleNewsStatus failed', e);
      alert('Failed to update — admin sign-in required.');
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    try {
      const r = await fetch('/api/academy/news-posts', {
        method: 'DELETE',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      reloadNews();
    } catch (e) {
      console.error(e);
      alert('Failed to delete article — admin sign-in required.');
    }
  };

  // Hand-off used by the WYSIWYG body editor: persist a compressed
  // base64 image to the news-images endpoint and return a stable URL
  // so the article HTML stays small and embeddable.
  const uploadInlineImage = useCallback(async (dataUrl: string): Promise<string> => {
    const r = await fetch('/api/academy/news-images', {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ dataUrl }),
    });
    if (!r.ok) throw new Error(`Upload failed: HTTP ${r.status}`);
    const j = await r.json();
    if (!j?.url) throw new Error('Upload response missing url');
    return j.url;
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* TIPS COLUMN */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Lightbulb size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Daily Food-Safety Tips</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Public landing carousel
              </p>
            </div>
          </div>
          <button
            onClick={newTip}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest"
          >
            <Plus size={13} /> New tip
          </button>
        </header>
        <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
          {loadingTips ? (
            <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : tips.length === 0 ? (
            <div className="p-10 text-center">
              <Lightbulb size={28} className="mx-auto text-slate-200 mb-3" />
              <p className="text-xs font-bold text-slate-400">
                No tips yet. Add the first one to populate the public carousel.
              </p>
            </div>
          ) : (
            tips.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">{t.title || 'Untitled'}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        t.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.status}
                    </span>
                    {t.category && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700">
                        {t.category}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs text-slate-500 line-clamp-2 mt-0.5"
                    dangerouslySetInnerHTML={{
                      __html: (t.excerpt || t.body || '').replace(/<[^>]+>/g, ' ').slice(0, 240),
                    }}
                  />
                  <div className="text-[10px] text-slate-400 font-bold mt-1 inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={11} /> {t.published_on}
                    </span>
                    {t.slug && (
                      <a
                        href={`/tips/${encodeURIComponent(t.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <ExternalLink size={10} /> /{t.slug}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditingTip(t)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deleteTip(t.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* NEWS COLUMN */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Newspaper size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Food Safety News</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Public home Live Intelligence Feed
              </p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-widest"
                  title="Total reader clicks on Regulatory column"
                >
                  <Eye size={10} /> Regulatory · {newsClickTotals.regulatory.toLocaleString()}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest"
                  title="Total reader clicks on Industry column"
                >
                  <Eye size={10} /> Industry · {newsClickTotals.industry.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => {
                setQuickLinkOpen(true);
                setQuickLinkUrl('');
                setQuickLinkPreview(null);
                setQuickLinkError('');
                setQuickLinkPinned(false);
                setQuickLinkCategory('General');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-sm"
              title="Paste a Google News (or any) article URL — we'll auto-fetch the headline and thumbnail."
            >
              <Link2 size={13} /> Quick add link
            </button>
            <button
              onClick={newPost}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest"
            >
              <Plus size={13} /> New article
            </button>
          </div>
        </header>

        {/* LIVE GOOGLE NEWS FEED (admin preview of what the public
            Industry Trends column is pulling right now). Lets editors
            see and curate live headlines without leaving the admin.
            Header uses two sibling buttons (expand/collapse + refresh)
            instead of a nested interactive — keeps semantics valid for
            keyboard / screen-reader users. */}
        <div className="border-b border-slate-200 bg-gradient-to-br from-emerald-50/60 to-white">
          <div className="px-5 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setLiveNewsExpanded((v) => !v)}
              aria-expanded={liveNewsExpanded}
              className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity text-left"
              title={liveNewsExpanded ? 'Collapse' : 'Expand'}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Globe2 size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  Live Google News feed
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest">
                    Live
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 truncate">
                  {liveNewsLoading
                    ? 'Fetching headlines from Google News…'
                    : liveNewsError
                      ? liveNewsError
                      : `${liveNews.length} headline${liveNews.length === 1 ? '' : 's'} pulled — click Save on any to add to Food Safety News`}
                </p>
              </div>
              {liveNewsExpanded ? (
                <ChevronDown size={14} className="text-slate-500 shrink-0 ml-1" />
              ) : (
                <ChevronRight size={14} className="text-slate-500 shrink-0 ml-1" />
              )}
            </button>
            <button
              type="button"
              onClick={reloadLiveNews}
              disabled={liveNewsLoading}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest shrink-0"
              title="Re-fetch live Google News"
            >
              <RefreshCw size={11} className={liveNewsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {liveNewsExpanded && (
            <div className="max-h-[360px] overflow-y-auto divide-y divide-emerald-100/70 border-t border-emerald-100/70">
              {liveNewsLoading ? (
                <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> Loading live headlines…
                </div>
              ) : liveNews.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold text-slate-400">
                  {liveNewsError || 'No live headlines available right now.'}
                </div>
              ) : (
                liveNews.map((it) => {
                  const alreadySaved = savedExternalUrls.has(canonicaliseUrl(it.link));
                  const saving = liveNewsSavingId === it.id;
                  const dateLabel = (() => {
                    const ts = it.published_on ? Date.parse(it.published_on) : NaN;
                    if (Number.isNaN(ts)) return '';
                    const d = new Date(ts);
                    return d.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                  })();
                  return (
                    <div
                      key={it.id}
                      className="px-5 py-3 flex items-start gap-3 hover:bg-white"
                    >
                      <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={normalizeImageUrl(it.image)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Newspaper size={18} className="text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={it.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] font-extrabold text-slate-900 hover:text-emerald-700 line-clamp-2 leading-snug"
                          title={it.title}
                        >
                          {it.title}
                        </a>
                        {it.excerpt && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                            {it.excerpt}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 font-bold mt-1 inline-flex items-center gap-2 flex-wrap">
                          {it.source && (
                            <span className="inline-flex items-center gap-1">
                              <Globe2 size={10} /> {it.source}
                            </span>
                          )}
                          {dateLabel && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={10} /> {dateLabel}
                            </span>
                          )}
                          <a
                            href={it.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
                          >
                            <ExternalLink size={10} /> Open
                          </a>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {alreadySaved ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest cursor-default"
                            title="Already saved as a Food Safety News article"
                          >
                            <Check size={11} /> Saved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => saveLiveItem(it)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white text-[10px] font-black uppercase tracking-widest"
                            title="Save this headline to Food Safety News"
                          >
                            {saving ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Plus size={11} />
                            )}
                            {saving ? 'Saving' : 'Save'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
          {loadingNews ? (
            <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : news.length === 0 ? (
            <div className="p-10 text-center">
              <Newspaper size={28} className="mx-auto text-slate-200 mb-3" />
              <p className="text-xs font-bold text-slate-400">
                No articles yet. Publish the first to populate the public news grid.
              </p>
            </div>
          ) : (
            news.map((n) => (
              <div key={n.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">{n.title || 'Untitled'}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        n.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {n.status}
                    </span>
                    {n.category && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700">
                        {n.category}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        n.feed_group === 'regulatory'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                      title="Live Intelligence Feed column"
                    >
                      {n.feed_group === 'regulatory' ? 'Regulatory' : 'General'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-700"
                      title="Reader clicks from the public Live Intelligence Feed"
                    >
                      <Eye size={10} /> {(newsClickCounts[n.id] || 0).toLocaleString()} clicks
                    </span>
                    {n.pinned && (
                      <span
                        className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700"
                        title="Pinned to the top of its feed column"
                      >
                        Pinned
                      </span>
                    )}
                    {n.auto_saved && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200"
                        title="Auto-saved from the live Google News feed. Use Hide to deactivate without deleting."
                      >
                        <Globe2 size={10} /> Auto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.excerpt}</p>
                  <div className="text-[10px] text-slate-400 font-bold mt-1 inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={11} /> {n.published_on}
                    </span>
                    {n.slug && (
                      <a
                        href={`/news/${encodeURIComponent(n.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <ExternalLink size={10} /> /{n.slug}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleNewsStatus(n)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      n.status === 'published'
                        ? 'text-amber-700 hover:bg-amber-50 border border-amber-200'
                        : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                    title={
                      n.status === 'published'
                        ? 'Hide from public Live Intelligence Feed (sets status to draft)'
                        : 'Show on public Live Intelligence Feed (sets status to published)'
                    }
                  >
                    {n.status === 'published' ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => setEditingPost(n)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deletePost(n.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                    title={
                      n.auto_saved
                        ? 'Delete (note: auto-saved rows reappear on next Google News pull — use Hide to keep deactivated permanently)'
                        : 'Delete'
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* TIP EDIT MODAL */}
      {editingTip && (
        <ContentModal
          title={editingTip.title ? 'Edit tip' : 'New tip'}
          onClose={() => setEditingTip(null)}
          onSave={saveTip}
          wide
        >
          <LanguageTabs value={tipLang} onChange={setTipLang} />

          {/* Language-neutral metadata (slug, author, cover, status,
              dates, read time) — same layout as the news article modal
              so editors get a consistent editorial UX across both
              content types. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <JobField label="Slug (URL)">
              <input
                value={editingTip.slug}
                onChange={(e) => setEditingTip({ ...editingTip, slug: slugify(e.target.value) })}
                className="content-input"
                placeholder="wash-hands-20-seconds"
              />
            </JobField>
            <JobField label="Author">
              <input
                value={editingTip.author || ''}
                onChange={(e) => setEditingTip({ ...editingTip, author: e.target.value })}
                className="content-input"
                placeholder="HACCP PRO Editorial"
              />
            </JobField>
            {/* Two image slots stacked in one grid column so the
                Status / Published / Read-time block on the right keeps
                its position. The first is the big in-page / home-page
                hero; the second is a smaller, hook-style thumbnail
                used only in social-share previews (WhatsApp, LinkedIn,
                Twitter, etc.). Authors can leave the share thumbnail
                blank — share previews then fall back to the cover. */}
            <div className="space-y-3">
              <JobField label="Cover image URL (in-page & home card)">
                <input
                  value={editingTip.cover_image}
                  onChange={(e) => setEditingTip({ ...editingTip, cover_image: e.target.value })}
                  className="content-input"
                  placeholder="https://… or a Google Drive file/d/…/view link"
                />
                <CoverImageHelper url={editingTip.cover_image} />
              </JobField>
              <JobField label="Share thumbnail URL (social media hook)">
                <input
                  value={editingTip.share_image}
                  onChange={(e) =>
                    setEditingTip({ ...editingTip, share_image: e.target.value })
                  }
                  className="content-input"
                  placeholder="https://… (recommended 1200×630, same shape as the home-page tip card)"
                />
                <CoverImageHelper url={editingTip.share_image} />
                <p className="mt-1 text-[10px] font-bold text-slate-400">
                  Shown as the preview when this tip is shared on WhatsApp,
                  LinkedIn, Twitter etc. Use a tight, scroll-stopping image
                  sized like the home-page tip card (≈ 1200×630, 16:9). Leave
                  blank to reuse the cover image above.
                </p>
              </JobField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <JobField label="Status">
                <select
                  value={editingTip.status}
                  onChange={(e) =>
                    setEditingTip({
                      ...editingTip,
                      status: e.target.value as 'published' | 'draft',
                    })
                  }
                  className="content-input"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </JobField>
              <JobField label="Published">
                <input
                  type="date"
                  value={editingTip.published_on}
                  onChange={(e) =>
                    setEditingTip({ ...editingTip, published_on: e.target.value })
                  }
                  className="content-input"
                />
              </JobField>
              <JobField label="Read (min)">
                <input
                  type="number"
                  min={1}
                  value={editingTip.read_minutes}
                  onChange={(e) =>
                    setEditingTip({
                      ...editingTip,
                      read_minutes: parseInt(e.target.value) || 1,
                    })
                  }
                  className="content-input"
                />
              </JobField>
            </div>
          </div>

          {/* Marketing-funnel attachments — turn this tip into a soft
              ad for an upcoming live training and / or a self-paced
              course. Both selectors are optional; the public reader
              page falls back to the next 1–3 upcoming public sessions
              when neither is set. Authors can pin up to 3 fallback
              sessions in their preferred order if the auto-match would
              pick the wrong ones, and the Preview panel below mirrors
              what readers will actually see today. */}
          <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600">
                <Target size={14} />
              </span>
              <div>
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">
                  Marketing funnel
                </h4>
                <p className="text-[10px] font-bold text-slate-500">
                  Attach this tip to a live training and / or course so the public
                  page becomes a lead-capture landing page.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <JobField label="Primary training session">
                <input
                  type="search"
                  value={tipTrainingFilter}
                  onChange={(e) => setTipTrainingFilter(e.target.value)}
                  placeholder="Type to filter sessions…"
                  className="content-input mb-2 text-[12px]"
                  aria-label="Filter training sessions"
                />
                <select
                  value={editingTip.related_training_session_id || ''}
                  onChange={(e) =>
                    setEditingTip({
                      ...editingTip,
                      related_training_session_id: e.target.value,
                    })
                  }
                  className="content-input"
                  size={Math.min(8, Math.max(4, trainingOptions.length + 1))}
                >
                  <option value="">— None (use fallbacks below) —</option>
                  {trainingOptions
                    .filter((s) => {
                      const q = tipTrainingFilter.trim().toLowerCase();
                      if (!q) return true;
                      const hay = [s.topic, s.subTopic, s.date, s.mode, s.id]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                      return hay.includes(q);
                    })
                    .map((s) => {
                      const label = [s.topic, s.subTopic].filter(Boolean).join(' — ') || s.id;
                      const meta = [s.date, s.mode].filter(Boolean).join(' · ');
                      return (
                        <option key={s.id} value={s.id}>
                          {label}
                          {meta ? `  (${meta})` : ''}
                        </option>
                      );
                    })}
                </select>
              </JobField>
              <JobField label="Related course">
                <input
                  type="search"
                  value={tipCourseFilter}
                  onChange={(e) => setTipCourseFilter(e.target.value)}
                  placeholder="Type to filter courses…"
                  className="content-input mb-2 text-[12px]"
                  aria-label="Filter courses"
                />
                <select
                  value={editingTip.related_course_id || ''}
                  onChange={(e) =>
                    setEditingTip({
                      ...editingTip,
                      related_course_id: e.target.value,
                    })
                  }
                  className="content-input"
                  size={Math.min(8, Math.max(4, courseOptions.length + 1))}
                >
                  <option value="">— None —</option>
                  {courseOptions
                    .filter((c) => {
                      const q = tipCourseFilter.trim().toLowerCase();
                      if (!q) return true;
                      const hay = [c.title, c.id].filter(Boolean).join(' ').toLowerCase();
                      return hay.includes(q);
                    })
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || c.id}
                      </option>
                    ))}
                </select>
              </JobField>
            </div>

            {/* Fallback sessions — admins pin up to 3 backups in the
                exact order the reader should see them. Used only when
                no Primary is set (or the Primary itself is hidden by
                the public sold-out / stale filter). */}
            <TipFallbackSessionsEditor
              value={editingTip.fallback_training_session_ids || []}
              onChange={(next) =>
                setEditingTip({
                  ...editingTip,
                  fallback_training_session_ids: next,
                })
              }
              trainingOptions={trainingOptions}
              disabled={!!editingTip.related_training_session_id}
            />

            {/* Preview — exactly what /tips/<slug> will render today,
                given the current Primary + fallback configuration and
                the live training calendar. Helps authors confirm the
                "Recommended Training" panel before publishing. */}
            <TipRecommendationPreview
              primaryId={editingTip.related_training_session_id}
              fallbackIds={editingTip.fallback_training_session_ids || []}
              category={editingTip.category}
              trainingOptions={trainingOptions}
            />
          </div>

          {tipLang === 'en' ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <JobField label="Title (English)">
                  <input
                    value={editingTip.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setEditingTip({
                        ...editingTip,
                        title,
                        slug: editingTip.slug || slugify(title),
                      });
                    }}
                    className="content-input"
                    placeholder="Wash hands for 20 seconds with warm water"
                  />
                </JobField>
                <JobField label="Category (English)">
                  <input
                    value={editingTip.category}
                    onChange={(e) => setEditingTip({ ...editingTip, category: e.target.value })}
                    className="content-input"
                    placeholder="Personal hygiene"
                  />
                </JobField>
              </div>
              <JobField label="Excerpt (English)">
                <textarea
                  value={editingTip.excerpt}
                  onChange={(e) => setEditingTip({ ...editingTip, excerpt: e.target.value })}
                  rows={2}
                  className="content-input resize-none"
                  placeholder="One- or two-sentence teaser shown on the tips grid."
                />
              </JobField>
              <JobField label="Body (English)">
                <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                  <RichTextEditor
                    value={editingTip.body}
                    onChange={(html) => setEditingTip({ ...editingTip, body: html })}
                    placeholder="Write the tip. Use the toolbar for headings, lists, links and images."
                    minHeight="280px"
                    onUploadImage={uploadInlineImage}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Tip: paste from Word or Google Docs — formatting is cleaned automatically.
                </p>
              </JobField>
              {/* Optional CTA copy overrides for the recommended-training
                  panel. When blank, the tip page falls back to the
                  default headline / button label from i18n. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <JobField label="CTA headline (English) — optional">
                  <input
                    value={editingTip.cta_headline || ''}
                    onChange={(e) =>
                      setEditingTip({ ...editingTip, cta_headline: e.target.value })
                    }
                    className="content-input"
                    placeholder="Don't just read it — get certified. Join HACCP PRO this month."
                  />
                </JobField>
                <JobField label="CTA button label (English) — optional">
                  <input
                    value={editingTip.cta_button_label || ''}
                    onChange={(e) =>
                      setEditingTip({ ...editingTip, cta_button_label: e.target.value })
                    }
                    className="content-input"
                    placeholder="Reserve my seat"
                  />
                </JobField>
              </div>
              {/* Editor-supplied "Expert Auditor Note" callout. Plain
                  text — rendered as a single paragraph on the public
                  tip detail page. Leave blank to hide the block. */}
              <JobField label="Expert Auditor Note (English) — optional">
                <textarea
                  value={editingTip.auditor_note || ''}
                  onChange={(e) =>
                    setEditingTip({ ...editingTip, auditor_note: e.target.value })
                  }
                  rows={3}
                  className="content-input resize-none"
                  placeholder="Practical, audit-floor insight that reinforces the tip (e.g. what auditors actually look for during an inspection)."
                />
                <p className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Shown in the green callout on the tip detail page. Leave blank to hide.
                </p>
              </JobField>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold text-slate-500">
                Hindi values are optional — any field left blank falls back to its English
                version on the public site.
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <JobField label="शीर्षक · Title (Hindi)">
                  <input
                    value={editingTip.translations?.hi?.title || ''}
                    onChange={(e) =>
                      setEditingTip({
                        ...editingTip,
                        translations: {
                          hi: {
                            ...(editingTip.translations?.hi || {}),
                            title: e.target.value,
                          },
                        },
                      })
                    }
                    className="content-input"
                    placeholder={editingTip.title || 'गुनगुने पानी और साबुन से 20 सेकंड हाथ धोएँ'}
                  />
                </JobField>
                <JobField label="श्रेणी · Category (Hindi)">
                  <input
                    value={editingTip.translations?.hi?.category || ''}
                    onChange={(e) =>
                      setEditingTip({
                        ...editingTip,
                        translations: {
                          hi: {
                            ...(editingTip.translations?.hi || {}),
                            category: e.target.value,
                          },
                        },
                      })
                    }
                    className="content-input"
                    placeholder={editingTip.category || 'व्यक्तिगत स्वच्छता'}
                  />
                </JobField>
              </div>
              <JobField label="संक्षेप · Excerpt (Hindi)">
                <textarea
                  value={editingTip.translations?.hi?.excerpt || ''}
                  onChange={(e) =>
                    setEditingTip({
                      ...editingTip,
                      translations: {
                        hi: {
                          ...(editingTip.translations?.hi || {}),
                          excerpt: e.target.value,
                        },
                      },
                    })
                  }
                  rows={2}
                  className="content-input resize-none"
                  placeholder={editingTip.excerpt || 'टिप्स ग्रिड पर दिखाई जाने वाली एक या दो पंक्तियों की झलक।'}
                />
              </JobField>
              <JobField label="मुख्य लेख · Body (Hindi)">
                <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                  <RichTextEditor
                    value={editingTip.translations?.hi?.body || ''}
                    onChange={(html) =>
                      setEditingTip({
                        ...editingTip,
                        translations: {
                          hi: {
                            ...(editingTip.translations?.hi || {}),
                            body: html,
                          },
                        },
                      })
                    }
                    placeholder="हिन्दी सलाह यहाँ लिखें। शीर्षक, सूची, लिंक और छवियाँ जोड़ने के लिए टूलबार का उपयोग करें।"
                    minHeight="280px"
                    onUploadImage={uploadInlineImage}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Tip: paste from Word or Google Docs — formatting is cleaned automatically.
                </p>
              </JobField>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <JobField label="CTA शीर्षक · CTA headline (Hindi) — वैकल्पिक">
                  <input
                    value={editingTip.translations?.hi?.cta_headline || ''}
                    onChange={(e) =>
                      setEditingTip({
                        ...editingTip,
                        translations: {
                          hi: {
                            ...(editingTip.translations?.hi || {}),
                            cta_headline: e.target.value,
                          },
                        },
                      })
                    }
                    className="content-input"
                    placeholder={
                      editingTip.cta_headline ||
                      'सिर्फ़ पढ़ें नहीं — प्रमाणित बनें। इस महीने HACCP PRO में दाखिला लें।'
                    }
                  />
                </JobField>
                <JobField label="CTA बटन · CTA button label (Hindi) — वैकल्पिक">
                  <input
                    value={editingTip.translations?.hi?.cta_button_label || ''}
                    onChange={(e) =>
                      setEditingTip({
                        ...editingTip,
                        translations: {
                          hi: {
                            ...(editingTip.translations?.hi || {}),
                            cta_button_label: e.target.value,
                          },
                        },
                      })
                    }
                    className="content-input"
                    placeholder={editingTip.cta_button_label || 'मेरी सीट आरक्षित करें'}
                  />
                </JobField>
              </div>
              <JobField label="विशेषज्ञ ऑडिटर नोट · Expert Auditor Note (Hindi) — वैकल्पिक">
                <textarea
                  value={editingTip.translations?.hi?.auditor_note || ''}
                  onChange={(e) =>
                    setEditingTip({
                      ...editingTip,
                      translations: {
                        hi: {
                          ...(editingTip.translations?.hi || {}),
                          auditor_note: e.target.value,
                        },
                      },
                    })
                  }
                  rows={3}
                  className="content-input resize-none"
                  placeholder={
                    editingTip.auditor_note ||
                    'व्यावहारिक, ऑडिट-फ्लोर अंतर्दृष्टि जो टिप को मज़बूती देती है।'
                  }
                />
              </JobField>
            </>
          )}
        </ContentModal>
      )}

      {/* POST EDIT MODAL */}
      {editingPost && (
        <ContentModal
          title={editingPost.title ? 'Edit article' : 'New article'}
          onClose={() => setEditingPost(null)}
          onSave={savePost}
          wide
        >
          <LanguageTabs value={postLang} onChange={setPostLang} />

          {/* CONTENT TYPE — decides whether the public news card opens
              an internal article reader (text mode, default) or routes
              the visitor through our /n/<token> share landing to an
              external publisher (link mode, Google-News-style). The
              link-mode flow keeps the training-ad interstitial in the
              path so curated outbound links still convert. */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Content type
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                [
                  {
                    v: 'text' as const,
                    title: 'Text content',
                    desc:
                      'Write the article body here. Visitors read it on our site.',
                  },
                  {
                    v: 'link' as const,
                    title: 'External link',
                    desc:
                      'Paste a URL. Clicks open the link via the training advertisement (Google News style).',
                  },
                ]
              ).map((opt) => {
                const active =
                  (editingPost.content_type === 'link' ? 'link' : 'text') ===
                  opt.v;
                return (
                  <button
                    type="button"
                    key={opt.v}
                    onClick={() => {
                      // Switching to LINK mode wipes the rich-text
                      // body on save (link posts can't have a reader
                      // page), so warn before we let the editor lose
                      // work they've already typed.
                      if (
                        opt.v === 'link' &&
                        editingPost.content_type !== 'link' &&
                        typeof editingPost.body === 'string' &&
                        editingPost.body.trim().length > 0
                      ) {
                        const ok = window.confirm(
                          'Switching to External link will discard the article body when you save. Continue?',
                        );
                        if (!ok) return;
                      }
                      setEditingPost({ ...editingPost, content_type: opt.v });
                    }}
                    className={`text-left rounded-xl border-2 px-3 py-2.5 transition ${
                      active
                        ? 'border-indigo-500 bg-white shadow-sm'
                        : 'border-slate-200 bg-white/60 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-3.5 h-3.5 rounded-full border-2 ${
                          active
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-slate-300 bg-white'
                        }`}
                      />
                      <span className="text-xs font-black text-slate-800">
                        {opt.title}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] font-bold text-slate-500 leading-snug">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metadata that stays language-neutral lives outside the
              language switch — slug/author/cover/status/dates only have
              one canonical value regardless of the visitor language. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <JobField label="Slug (URL)">
              <input
                value={editingPost.slug}
                onChange={(e) => setEditingPost({ ...editingPost, slug: slugify(e.target.value) })}
                className="content-input"
                placeholder="fssai-haccp-cloud-kitchens"
              />
            </JobField>
            <JobField label="Author">
              <input
                value={editingPost.author || ''}
                onChange={(e) => setEditingPost({ ...editingPost, author: e.target.value })}
                className="content-input"
                placeholder="HACCP PRO Editorial"
              />
            </JobField>
            <JobField label="Cover image URL">
              <input
                value={editingPost.cover_image}
                onChange={(e) => setEditingPost({ ...editingPost, cover_image: e.target.value })}
                className="content-input"
                placeholder="https://… or a Google Drive file/d/…/view link"
              />
              <CoverImageHelper url={editingPost.cover_image} />
            </JobField>
            <div className="grid grid-cols-3 gap-3">
              <JobField label="Status">
                <select
                  value={editingPost.status}
                  onChange={(e) =>
                    setEditingPost({
                      ...editingPost,
                      status: e.target.value as 'published' | 'draft',
                    })
                  }
                  className="content-input"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </JobField>
              <JobField label="Published">
                <input
                  type="date"
                  value={editingPost.published_on}
                  onChange={(e) =>
                    setEditingPost({ ...editingPost, published_on: e.target.value })
                  }
                  className="content-input"
                />
              </JobField>
              <JobField label="Read (min)">
                <input
                  type="number"
                  min={1}
                  value={editingPost.read_minutes}
                  onChange={(e) =>
                    setEditingPost({
                      ...editingPost,
                      read_minutes: parseInt(e.target.value) || 1,
                    })
                  }
                  className="content-input"
                />
              </JobField>
            </div>
            {/* Feed column placement is now driven entirely by the
                CATEGORY dropdown below (Regulatory → Regulatory column,
                General → General/Industry column), so the redundant
                Feed Column selector has been removed. */}
            {/* Industry Trends rows route OUT to Google News by default
                — admins can pin a specific publisher URL here to
                override the auto-generated search link. */}
            {/* The URL field is mandatory in LINK mode (it IS the
                article) and optional in TEXT mode for General-column
                rows where editors can pin a publisher override. We
                keep both behaviors so legacy Industry rows keep
                working. */}
            {editingPost.content_type === 'link' ? (
              <JobField label="External link URL">
                <input
                  type="url"
                  placeholder="https://www.example.com/article"
                  value={editingPost.external_url || ''}
                  onChange={(e) =>
                    setEditingPost({ ...editingPost, external_url: e.target.value })
                  }
                  className="content-input"
                />
                <p className="mt-1 text-[10px] font-bold text-indigo-500">
                  Visitors clicking this card will see the training advertisement, then be redirected here.
                </p>
              </JobField>
            ) : (
              normalizeArticleCategory(editingPost.category, editingPost.feed_group) === 'General' && (
                <JobField label="External source URL (optional)">
                  <input
                    type="url"
                    placeholder="https://www.example.com/article"
                    value={editingPost.external_url || ''}
                    onChange={(e) =>
                      setEditingPost({ ...editingPost, external_url: e.target.value })
                    }
                    className="content-input"
                  />
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    Leave blank to auto-link this row to a Google News search of its title.
                  </p>
                </JobField>
              )
            )}
            {/* Pin to top — overrides published_on ordering inside the
                chosen feed column. Useful for evergreen / flagship
                articles editors want to keep at the top of the column. */}
            <label className="flex items-start gap-2 mt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!editingPost.pinned}
                onChange={(e) =>
                  setEditingPost({ ...editingPost, pinned: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-400"
              />
              <span>
                <span className="block text-xs font-black text-slate-700">
                  Pin to top of feed column
                </span>
                <span className="block text-[10px] font-bold text-slate-400">
                  Pinned articles appear above date-sorted ones in the public Live Intelligence Feed.
                </span>
              </span>
            </label>
          </div>

          {postLang === 'en' ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <JobField label="Title (English)">
                  <input
                    value={editingPost.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setEditingPost({
                        ...editingPost,
                        title,
                        slug: editingPost.slug || slugify(title),
                      });
                    }}
                    className="content-input"
                    placeholder="FSSAI updates HACCP guidance for cloud kitchens"
                  />
                </JobField>
                <JobField label="Category (English)">
                  <select
                    value={normalizeArticleCategory(editingPost.category, editingPost.feed_group)}
                    onChange={(e) => {
                      const next = e.target.value === 'Regulatory' ? 'Regulatory' : 'General';
                      setEditingPost({
                        ...editingPost,
                        category: next,
                        // Keep feed_group in lock-step so legacy
                        // consumers (analytics, older callers) and
                        // the public feed agree on placement.
                        feed_group: next === 'Regulatory' ? 'regulatory' : 'industry',
                        // Mirror the choice into the Hindi label so
                        // both tabs stay consistent unless the editor
                        // overrides the Hindi value explicitly.
                        translations: {
                          hi: {
                            ...(editingPost.translations?.hi || {}),
                            category: HINDI_CATEGORY_LABEL[next],
                          },
                        },
                      });
                    }}
                    className="content-input"
                  >
                    <option value="Regulatory">Regulatory</option>
                    <option value="General">General</option>
                  </select>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    Decides which column shows this article on the public Live Intelligence Feed.
                  </p>
                </JobField>
              </div>
              <JobField label="Excerpt (English)">
                <textarea
                  value={editingPost.excerpt}
                  onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                  rows={3}
                  className="content-input resize-none"
                  placeholder="One- or two-sentence teaser shown on the news grid."
                />
              </JobField>
              {editingPost.content_type !== 'link' && (
                <JobField label="Body (English)">
                  <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                    <RichTextEditor
                      value={editingPost.body}
                      onChange={(html) => setEditingPost({ ...editingPost, body: html })}
                      placeholder="Write the article. Use the toolbar for headings, lists, links and images."
                      minHeight="320px"
                      onUploadImage={uploadInlineImage}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Tip: paste from Word or Google Docs — formatting is cleaned automatically.
                  </p>
                </JobField>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold text-slate-500">
                Hindi values are optional — any field left blank falls back to its English
                version on the public site.
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <JobField label="शीर्षक · Title (Hindi)">
                  <input
                    value={editingPost.translations?.hi?.title || ''}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        translations: {
                          hi: {
                            ...(editingPost.translations?.hi || {}),
                            title: e.target.value,
                          },
                        },
                      })
                    }
                    className="content-input"
                    placeholder={editingPost.title || 'क्लाउड किचन के लिए FSSAI ने HACCP दिशा-निर्देश अपडेट किए'}
                  />
                </JobField>
                <JobField label="श्रेणी · Category (Hindi)">
                  <select
                    value={
                      HINDI_CATEGORY_LABEL[
                        normalizeHindiArticleCategory(
                          editingPost.translations?.hi?.category,
                          normalizeArticleCategory(
                            editingPost.category,
                            editingPost.feed_group,
                          ),
                        )
                      ]
                    }
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        translations: {
                          hi: {
                            ...(editingPost.translations?.hi || {}),
                            category: e.target.value,
                          },
                        },
                      })
                    }
                    className="content-input"
                  >
                    <option value={HINDI_CATEGORY_LABEL.Regulatory}>
                      {HINDI_CATEGORY_LABEL.Regulatory} (Regulatory)
                    </option>
                    <option value={HINDI_CATEGORY_LABEL.General}>
                      {HINDI_CATEGORY_LABEL.General} (General)
                    </option>
                  </select>
                </JobField>
              </div>
              <JobField label="संक्षेप · Excerpt (Hindi)">
                <textarea
                  value={editingPost.translations?.hi?.excerpt || ''}
                  onChange={(e) =>
                    setEditingPost({
                      ...editingPost,
                      translations: {
                        hi: {
                          ...(editingPost.translations?.hi || {}),
                          excerpt: e.target.value,
                        },
                      },
                    })
                  }
                  rows={3}
                  className="content-input resize-none"
                  placeholder={editingPost.excerpt || 'समाचार ग्रिड पर दिखाई जाने वाली एक या दो पंक्तियों की झलक।'}
                />
              </JobField>
              <JobField label="मुख्य लेख · Body (Hindi)">
                <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                  <RichTextEditor
                    value={editingPost.translations?.hi?.body || ''}
                    onChange={(html) =>
                      setEditingPost({
                        ...editingPost,
                        translations: {
                          hi: {
                            ...(editingPost.translations?.hi || {}),
                            body: html,
                          },
                        },
                      })
                    }
                    placeholder="हिन्दी लेख यहाँ लिखें। शीर्षक, सूची, लिंक और छवियाँ जोड़ने के लिए टूलबार का उपयोग करें।"
                    minHeight="320px"
                    onUploadImage={uploadInlineImage}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Tip: paste from Word or Google Docs — formatting is cleaned automatically.
                </p>
              </JobField>
            </>
          )}
        </ContentModal>
      )}

      {/* QUICK ADD LINK MODAL — paste a Google News (or any) article URL,
          we auto-fetch headline + thumbnail + excerpt from the publisher
          page, editor confirms and publishes in one click. */}
      {quickLinkOpen && (
        <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full max-w-xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[92vh] overflow-hidden">
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Link2 size={15} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900 truncate">
                    Quick add link
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Paste a Google News article URL
                  </p>
                </div>
              </div>
              <button
                onClick={closeQuickLink}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* URL input + fetch button */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  News article URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    autoFocus
                    value={quickLinkUrl}
                    onChange={(e) => {
                      setQuickLinkUrl(e.target.value);
                      if (quickLinkError) setQuickLinkError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !quickLinkFetching && !quickLinkSaving) {
                        e.preventDefault();
                        fetchQuickLinkPreview();
                      }
                    }}
                    placeholder="https://news.google.com/articles/… or any article URL"
                    className="content-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={fetchQuickLinkPreview}
                    disabled={quickLinkFetching || !quickLinkUrl.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {quickLinkFetching ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Fetching
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} /> Fetch
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                  We'll read the page and pre-fill the headline, excerpt, and thumbnail.
                </p>
              </div>

              {/* Error / hint */}
              {quickLinkError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>{quickLinkError}</span>
                </div>
              )}

              {/* Editable preview — editor can tweak the auto-fetched
                  fields before publishing. */}
              {quickLinkPreview && (
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                    <CheckCircle2 size={12} /> Preview
                  </div>

                  {/* Thumbnail preview row */}
                  <div className="flex items-start gap-3">
                    {quickLinkPreview.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={quickLinkPreview.image}
                        alt=""
                        className="w-24 h-24 rounded-xl object-cover bg-slate-200 border border-slate-200 shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        type="url"
                        value={quickLinkPreview.image}
                        onChange={(e) =>
                          setQuickLinkPreview({ ...quickLinkPreview, image: e.target.value })
                        }
                        placeholder="Thumbnail URL"
                        className="content-input text-xs"
                      />
                      {quickLinkPreview.publisher && (
                        <p className="text-[10px] font-bold text-slate-500 inline-flex items-center gap-1">
                          <Globe2 size={10} /> {quickLinkPreview.publisher}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Headline
                    </label>
                    <input
                      type="text"
                      value={quickLinkPreview.title}
                      onChange={(e) =>
                        setQuickLinkPreview({ ...quickLinkPreview, title: e.target.value })
                      }
                      placeholder="Article headline"
                      className="content-input"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Excerpt
                    </label>
                    <textarea
                      value={quickLinkPreview.excerpt}
                      onChange={(e) =>
                        setQuickLinkPreview({ ...quickLinkPreview, excerpt: e.target.value })
                      }
                      placeholder="Short description shown under the headline"
                      rows={2}
                      className="content-input resize-y min-h-[60px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Feed column
                      </label>
                      <select
                        value={quickLinkCategory}
                        onChange={(e) =>
                          setQuickLinkCategory(e.target.value as 'General' | 'Regulatory')
                        }
                        className="content-input"
                      >
                        <option value="General">General (Industry)</option>
                        <option value="Regulatory">Regulatory</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-white w-full">
                        <input
                          type="checkbox"
                          checked={quickLinkPinned}
                          onChange={(e) => setQuickLinkPinned(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-400"
                        />
                        <span className="text-[11px] font-black text-slate-700">
                          Pin to top
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <footer className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0 bg-slate-50">
              <button
                onClick={closeQuickLink}
                className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={saveQuickLink}
                disabled={
                  !quickLinkPreview ||
                  quickLinkSaving ||
                  !quickLinkPreview.title.trim()
                }
                className="px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {quickLinkSaving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Publishing
                  </>
                ) : (
                  <>
                    <Check size={13} /> Publish
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}

      <style jsx>{`
        .content-input {
          width: 100%;
          border: 2px solid rgb(226 232 240);
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          font-weight: 600;
          background-color: white;
          outline: none;
          color: rgb(15 23 42);
        }
        .content-input:focus {
          border-color: rgb(129 140 248);
        }
      `}</style>
    </div>
  );
}

// Shared option shape — what `trainingOptions` carries inside
// ContentManagement. Kept here so the fallback editor and preview
// panel can both type-check against the same fields.
type TrainingOption = {
  id: string;
  topic?: string;
  subTopic?: string;
  description?: string;
  date?: string;
  mode?: string;
  status?: string;
  isActive?: boolean;
  registrationExpiryDate?: string;
};

// Mirrors the public reader's filter — keeps an admin's preview panel
// honest about which sessions actually qualify as a fallback today.
// Sessions with missing / unparsable dates are treated as not-upcoming
// to match TipReaderPage.isBookableSession exactly.
const isAdminBookable = (s: TrainingOption, todayMs: number): boolean => {
  if (!s) return false;
  if (s.isActive === false) return false;
  if ((s.status || '').toLowerCase() === 'completed') return false;
  if (!s.date) return false;
  const d = Date.parse(s.date);
  if (Number.isNaN(d)) return false;
  if (d < todayMs) return false;
  if (s.registrationExpiryDate) {
    const exp = Date.parse(s.registrationExpiryDate);
    if (!Number.isNaN(exp) && exp < todayMs) return false;
  }
  return true;
};

const adminNorm = (s: string | undefined): string =>
  (s || '').toLowerCase().normalize('NFKD').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();

const formatSessionLabel = (s: TrainingOption): string => {
  const label = [s.topic, s.subTopic].filter(Boolean).join(' \u2014 ') || s.id;
  const meta = [s.date, s.mode].filter(Boolean).join(' \u00B7 ');
  return meta ? `${label}  (${meta})` : label;
};

// Reorderable, deduped picker for the up-to-3 fallback session IDs an
// admin pins on a tip. Sessions disappear from the "Add" dropdown once
// they're already in the list, so authors can't accidentally create
// duplicates. Disabled when a Primary session is set, since the
// reader will never reach the fallback list in that case.
function TipFallbackSessionsEditor({
  value,
  onChange,
  trainingOptions,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  trainingOptions: TrainingOption[];
  disabled?: boolean;
}) {
  const [pickerValue, setPickerValue] = useState('');
  const optionById = useMemo(() => {
    const m = new Map<string, TrainingOption>();
    for (const s of trainingOptions) m.set(s.id, s);
    return m;
  }, [trainingOptions]);
  const used = new Set(value);
  const remaining = trainingOptions.filter((s) => !used.has(s.id));
  const atMax = value.length >= 3;
  const move = (idx: number, dir: -1 | 1) => {
    const next = value.slice();
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };
  const add = (id: string) => {
    if (!id || used.has(id) || value.length >= 3) return;
    onChange([...value, id]);
    setPickerValue('');
  };
  return (
    <div
      className={`rounded-xl border border-indigo-100 bg-white/70 p-3 space-y-2 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
            Fallback sessions (up to 3)
          </div>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">
            {disabled
              ? 'A Primary session is set above — fallbacks are ignored. Clear the Primary to use this list.'
              : 'Pinned in this exact order. When a Primary is not set, the reader shows these instead of the auto-match.'}
          </p>
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {value.length}/3
        </span>
      </div>
      {value.length === 0 ? (
        <p className="text-[11px] font-bold text-slate-400 italic">
          None pinned — reader will auto-pick by tip category.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {value.map((id, idx) => {
            const s = optionById.get(id);
            const label = s ? formatSessionLabel(s) : `Unknown session (${id})`;
            return (
              <li
                key={`${id}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black">
                  {idx + 1}
                </span>
                <span className="flex-1 min-w-0 text-[12px] font-bold text-slate-700 truncate">
                  {label}
                  {!s && (
                    <span className="ml-1 text-[10px] font-black text-amber-600 uppercase">
                      not in upcoming list
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={disabled || idx === 0}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  aria-label="Move up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={disabled || idx === value.length - 1}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  aria-label="Move down"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={disabled}
                  className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  aria-label="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {!atMax && (
        <select
          value={pickerValue}
          onChange={(e) => add(e.target.value)}
          disabled={disabled || remaining.length === 0}
          className="content-input text-[12px]"
          aria-label="Add fallback session"
        >
          <option value="">
            {remaining.length === 0
              ? '— No upcoming sessions left to pin —'
              : '+ Add a fallback session…'}
          </option>
          {remaining.map((s) => (
            <option key={s.id} value={s.id}>
              {formatSessionLabel(s)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// "What will readers see today?" — runs the same Primary / pinned /
// auto-match cascade as TipReaderPage, but against the live training
// calendar so authors can confirm the panel before publishing.
function TipRecommendationPreview({
  primaryId,
  fallbackIds,
  category,
  trainingOptions,
}: {
  primaryId?: string;
  fallbackIds: string[];
  category?: string;
  trainingOptions: TrainingOption[];
}) {
  const result = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const upcoming = trainingOptions
      .filter((s) => isAdminBookable(s, todayMs))
      .slice()
      .sort((a, b) => Date.parse(a.date || '') - Date.parse(b.date || ''));
    const upcomingById = new Map(upcoming.map((s) => [s.id, s]));
    // Mirror TipReaderPage: explicitSession only "wins" when the
    // session id actually resolves against the calendar. If it doesn't,
    // the reader falls through to the pinned / auto cascade — preview
    // must do the same so authors see what readers will actually see.
    if (primaryId) {
      const hit = trainingOptions.find((s) => s.id === primaryId) || null;
      if (hit) {
        return { mode: 'primary' as const, sessions: [hit], notes: [] };
      }
      // fall through with a note so the author understands why the
      // pinned / auto list is showing despite a Primary being set.
    }
    const primaryNotes: string[] = primaryId
      ? ['Primary session id not found in calendar — showing fallback instead.']
      : [];
    const pinned = (fallbackIds || [])
      .map((id) => upcomingById.get(id))
      .filter((s): s is TrainingOption => !!s)
      .slice(0, 3);
    if (pinned.length) {
      const dropped = (fallbackIds || []).length - pinned.length;
      const notes: string[] = [...primaryNotes];
      if (dropped > 0) {
        notes.push(`${dropped} pinned session(s) hidden — sold out, completed, or in the past.`);
      }
      return { mode: 'pinned' as const, sessions: pinned, notes };
    }
    const cat = adminNorm(category);
    if (!cat) {
      return {
        mode: 'auto' as const,
        sessions: upcoming.slice(0, 3),
        notes: [...primaryNotes, 'No category set — reader shows the next 3 upcoming sessions.'],
      };
    }
    const matching = upcoming.filter((s) => {
      const haystack = adminNorm(`${s.topic || ''} ${s.subTopic || ''} ${s.description || ''}`);
      return (
        haystack.includes(cat) ||
        cat.split(' ').some((tok) => tok.length > 3 && haystack.includes(tok))
      );
    });
    if (matching.length) {
      return { mode: 'auto' as const, sessions: matching.slice(0, 3), notes: [...primaryNotes] };
    }
    return {
      mode: 'auto' as const,
      sessions: upcoming.slice(0, 3),
      notes: [...primaryNotes, 'No category match — reader will show the next 3 upcoming sessions.'],
    };
  }, [primaryId, fallbackIds, category, trainingOptions]);

  const modeBadge =
    result.mode === 'primary'
      ? { label: 'Primary', cls: 'bg-emerald-100 text-emerald-700' }
      : result.mode === 'pinned'
        ? { label: 'Pinned fallbacks', cls: 'bg-indigo-100 text-indigo-700' }
        : { label: 'Auto-match', cls: 'bg-amber-100 text-amber-700' };

  return (
    <div className="rounded-xl border border-indigo-100 bg-white/70 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
          Preview recommended sessions
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${modeBadge.cls}`}
        >
          {modeBadge.label}
        </span>
      </div>
      {result.sessions.length === 0 ? (
        <p className="text-[11px] font-bold text-slate-400 italic">
          No sessions would render today.
        </p>
      ) : (
        <ol className="space-y-1">
          {result.sessions.map((s, idx) => (
            <li
              key={`${s.id}-${idx}`}
              className="flex items-center gap-2 text-[12px] font-bold text-slate-700"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black">
                {idx + 1}
              </span>
              <span className="truncate">{formatSessionLabel(s)}</span>
            </li>
          ))}
        </ol>
      )}
      {result.notes.map((n, i) => (
        <p key={i} className="text-[10px] font-bold text-slate-500 italic">
          {n}
        </p>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}

// Compact two-tab pill that lets admins flip between editing the
// canonical English copy and the optional Hindi variant. Displayed
// inside both the tip and news article modals.
function LanguageTabs({
  value,
  onChange,
}: {
  value: AdminContentLang;
  onChange: (l: AdminContentLang) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 self-start">
      {ADMIN_CONTENT_LANGUAGES.map((opt) => {
        const active = opt.code === value;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
              active
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ContentModal({
  title,
  onClose,
  onSave,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-6">
      <div
        className={`bg-white w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[92vh] overflow-hidden`}
      >
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        <footer className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TIP LEADS — attribution view for the public lead-capture form on
// /tips/[slug]. The public form posts to /api/academy/public-enrolments
// with `notes: "tip:<slug>"`; we extract the slug here so editors can
// see which tip pages convert into bookings, and (when present) the
// utm_source/medium/campaign that the visitor arrived with.
// ─────────────────────────────────────────────────────────────────────

interface PublicEnrolment {
  id: string;
  course_id: string;
  course_title: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
}

const TIP_SLUG_RE = /^tip:(.+)$/i;

function extractTipSlug(row: PublicEnrolment): string | null {
  const fromNotes = row.notes?.match(TIP_SLUG_RE)?.[1]?.trim();
  if (fromNotes) return fromNotes;
  const fromCourseId = row.course_id?.match(TIP_SLUG_RE)?.[1]?.trim();
  if (fromCourseId) return fromCourseId;
  // Some leads arrive via the share link with utm_campaign=tip-<slug>
  // but the form itself was never opened from the tip — keep that as a
  // last-resort attribution signal so editors don't lose the data.
  const fromCampaign = row.utm_campaign?.match(/^tip-(.+)$/i)?.[1]?.trim();
  return fromCampaign || null;
}

function formatLeadDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type LeadSort = 'date_desc' | 'date_asc' | 'tip_asc' | 'source_asc';

function TipLeadsManagement() {
  const [leads, setLeads] = useState<PublicEnrolment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tipFilter, setTipFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sort, setSort] = useState<LeadSort>('date_desc');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await fetch('/api/academy/public-enrolments', { headers: adminHeaders() });
      if (!r.ok) {
        if (r.status === 401) {
          setErrorMsg('Sign in as an admin to view tip leads.');
        } else {
          setErrorMsg('Could not load leads. Please try again.');
        }
        setLeads([]);
        return;
      }
      const j = await r.json().catch(() => null);
      setLeads(Array.isArray(j?.items) ? j.items : []);
    } catch {
      setErrorMsg('Network error while loading leads.');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const tipLeads = useMemo(
    () => leads.map(l => ({ row: l, tipSlug: extractTipSlug(l) })),
    [leads],
  );

  const tipsOnly = useMemo(
    () => tipLeads.filter(x => !!x.tipSlug),
    [tipLeads],
  );

  const tipCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { tipSlug } of tipsOnly) {
      if (!tipSlug) continue;
      m.set(tipSlug, (m.get(tipSlug) || 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => ({ slug, count }));
  }, [tipsOnly]);

  const topTips = useMemo(() => tipCounts.slice(0, 5), [tipCounts]);
  const maxTopCount = topTips[0]?.count || 0;

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const { row } of tipLeads) {
      if (row.utm_source) set.add(row.utm_source);
    }
    return Array.from(set).sort();
  }, [tipLeads]);

  const tipSlugOptions = useMemo(() => tipCounts.map(t => t.slug), [tipCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = tipLeads.filter(({ row, tipSlug }) => {
      if (tipFilter !== 'all') {
        if (tipFilter === '__none__' ? !!tipSlug : tipSlug !== tipFilter) return false;
      }
      if (sourceFilter !== 'all') {
        if (sourceFilter === '__none__' ? !!row.utm_source : row.utm_source !== sourceFilter) return false;
      }
      if (!q) return true;
      const hay = [
        row.name, row.email, row.phone, row.course_title, row.course_id,
        row.notes, row.utm_source, row.utm_medium, row.utm_campaign, tipSlug,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    if (sort === 'date_asc') {
      rows = [...rows].sort((a, b) => Date.parse(a.row.created_at) - Date.parse(b.row.created_at));
    } else if (sort === 'tip_asc') {
      rows = [...rows].sort((a, b) =>
        (a.tipSlug || '~').localeCompare(b.tipSlug || '~') ||
        Date.parse(b.row.created_at) - Date.parse(a.row.created_at),
      );
    } else if (sort === 'source_asc') {
      rows = [...rows].sort((a, b) =>
        (a.row.utm_source || '~').localeCompare(b.row.utm_source || '~') ||
        Date.parse(b.row.created_at) - Date.parse(a.row.created_at),
      );
    } else {
      rows = [...rows].sort((a, b) => Date.parse(b.row.created_at) - Date.parse(a.row.created_at));
    }
    return rows;
  }, [tipLeads, tipFilter, sourceFilter, search, sort]);

  const totalLeads = leads.length;
  const tipAttributed = tipsOnly.length;
  const distinctTips = tipCounts.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Leads</p>
          <p className="text-3xl font-black text-slate-900 tracking-tight">{totalLeads.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">Across all public enrolment forms</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">From Tip Pages</p>
          <p className="text-3xl font-black text-indigo-600 tracking-tight">{tipAttributed.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">Tagged <code className="text-[10px]">tip:&lt;slug&gt;</code></p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Distinct Tips Converting</p>
          <p className="text-3xl font-black text-emerald-600 tracking-tight">{distinctTips.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">Unique tip slugs with at least 1 lead</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Trophy size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Tips That Converted</h3>
            <p className="text-[10px] text-slate-400 font-bold">Top 5 tips by lead count</p>
          </div>
        </div>
        {topTips.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 py-6 text-center">
            No tip-attributed leads yet. Once visitors submit the lead-capture form on a /tips/&lt;slug&gt; page, they will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {topTips.map(({ slug, count }) => {
              const pct = maxTopCount > 0 ? Math.max(6, Math.round((count / maxTopCount) * 100)) : 0;
              return (
                <div key={slug} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTipFilter(slug)}
                    className="text-left text-xs font-black text-slate-700 hover:text-indigo-600 underline-offset-2 hover:underline truncate w-48 sm:w-64 shrink-0"
                    title={`Filter table by tip:${slug}`}
                  >
                    {slug}
                  </button>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-slate-700 tabular-nums w-12 text-right shrink-0">
                    {count.toLocaleString()}
                  </span>
                  <a
                    href={`/tips/${encodeURIComponent(slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
                    title="Open the live tip page"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Public Enrolment Queue</h3>
              <p className="text-[10px] text-slate-400 font-bold">{filtered.length} of {totalLeads} leads shown</p>
            </div>
          </div>
          <button
            onClick={fetchLeads}
            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 border-2 border-slate-200"
            title="Refresh leads"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, slug, source..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-400 outline-none"
            />
          </div>
          <select
            value={tipFilter}
            onChange={e => setTipFilter(e.target.value)}
            className="border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white focus:border-indigo-400 outline-none"
            title="Filter by tip slug"
          >
            <option value="all">All Tips</option>
            <option value="__none__">No tip attribution</option>
            {tipSlugOptions.map(slug => (
              <option key={slug} value={slug}>tip:{slug}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white focus:border-indigo-400 outline-none"
            title="Filter by utm_source"
          >
            <option value="all">All Sources</option>
            <option value="__none__">No utm_source</option>
            {sourceOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as LeadSort)}
            className="border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white focus:border-indigo-400 outline-none"
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="tip_asc">Tip slug (A→Z)</option>
            <option value="source_asc">Source (A→Z)</option>
          </select>
          {(tipFilter !== 'all' || sourceFilter !== 'all' || search) && (
            <button
              onClick={() => { setTipFilter('all'); setSourceFilter('all'); setSearch(''); }}
              className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : errorMsg ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 py-10 text-center">
            No leads match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Lead</th>
                  <th className="px-3 py-2.5">Tip</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Campaign</th>
                  <th className="px-3 py-2.5">Course</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(({ row, tipSlug }) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 text-slate-500 font-bold whitespace-nowrap">
                      {formatLeadDate(row.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-black text-slate-800">{row.name || '—'}</div>
                      {row.email && <div className="text-[11px] text-slate-500 font-bold truncate max-w-[200px]">{row.email}</div>}
                      {row.phone && <div className="text-[11px] text-slate-400 font-bold">{row.phone}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      {tipSlug ? (
                        <a
                          href={`/tips/${encodeURIComponent(tipSlug)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-black text-[10px] uppercase tracking-widest hover:bg-amber-100"
                          title={`tip:${tipSlug}`}
                        >
                          <Lightbulb size={10} /> {tipSlug}
                        </a>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.utm_source ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-widest">
                          {row.utm_source}
                          {row.utm_medium ? ` · ${row.utm_medium}` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">direct</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-600 truncate max-w-[160px]">
                      {row.utm_campaign || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-600 truncate max-w-[200px]" title={row.course_title || row.course_id}>
                      {row.course_title || row.course_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface NewsKeywordRow {
  id: string;
  keyword: string;
  language: 'en' | 'hi' | 'mix';
  enabled: boolean;
  sort_order: number;
  last_fetched_at?: string | null;
  last_result_count?: number | null;
  last_error?: string | null;
  last_error_at?: string | null;
  click_count?: number;
}

function formatRelativeTime(ts: string | null | undefined): string {
  if (!ts) return 'never';
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return 'never';
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

function NewsKeywordsManagement() {
  const [items, setItems] = useState<NewsKeywordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [draftKeyword, setDraftKeyword] = useState('');
  const [draftLanguage, setDraftLanguage] = useState<'en' | 'hi' | 'mix'>('mix');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState('');
  const [editLanguage, setEditLanguage] = useState<'en' | 'hi' | 'mix'>('mix');
  const [error, setError] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/academy/news-keywords', { headers: adminHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(Array.isArray(j?.items) ? j.items : []);
    } catch (e) {
      console.error('reload news keywords failed', e);
      setItems([]);
      setError('Failed to load — admin sign-in required.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveOne = async (row: Partial<NewsKeywordRow> & { id?: string }) => {
    setSavingId(row.id || 'new');
    setError('');
    try {
      const r = await fetch('/api/academy/news-keywords', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(row),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      console.error('save news keyword failed', e);
      setError('Failed to save — admin sign-in required.');
    } finally {
      setSavingId(null);
    }
  };

  const addKeyword = async () => {
    const text = draftKeyword.trim();
    if (!text) return;
    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    await saveOne({
      keyword: text,
      language: draftLanguage,
      enabled: true,
      sort_order: nextOrder,
    });
    setDraftKeyword('');
    setDraftLanguage('mix');
  };

  const beginEdit = (row: NewsKeywordRow) => {
    setEditingId(row.id);
    setEditKeyword(row.keyword);
    setEditLanguage(row.language);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const original = items.find((i) => i.id === editingId);
    if (!original) {
      setEditingId(null);
      return;
    }
    const text = editKeyword.trim();
    if (!text) {
      setError('Keyword cannot be empty');
      return;
    }
    await saveOne({ ...original, keyword: text, language: editLanguage });
    setEditingId(null);
  };

  const toggleEnabled = async (row: NewsKeywordRow) => {
    await saveOne({ ...row, enabled: !row.enabled });
  };

  const removeRow = async (row: NewsKeywordRow) => {
    if (!confirm(`Delete keyword "${row.keyword}"?`)) return;
    setSavingId(row.id);
    setError('');
    try {
      const r = await fetch('/api/academy/news-keywords', {
        method: 'DELETE',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: row.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      console.error('delete news keyword failed', e);
      setError('Failed to delete — admin sign-in required.');
    } finally {
      setSavingId(null);
    }
  };

  const persistOrder = async (reordered: NewsKeywordRow[]) => {
    setItems(reordered);
    try {
      const r = await fetch('/api/academy/news-keywords', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reorder: reordered.map((row, i) => ({ id: row.id, sort_order: i })),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      console.error('reorder news keywords failed', e);
      setError('Failed to reorder — admin sign-in required.');
      reload();
    }
  };

  const moveRow = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    const [m] = reordered.splice(idx, 1);
    reordered.splice(target, 0, m);
    await persistOrder(reordered);
  };

  const handleDrop = async (targetId: string) => {
    const sourceId = draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const fromIdx = items.findIndex((i) => i.id === sourceId);
    const toIdx = items.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...items];
    const [m] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, m);
    await persistOrder(reordered);
  };

  const refreshFeed = async () => {
    setRefreshing(true);
    setError('');
    try {
      const r = await fetch('/api/academy/news-keywords?refresh=1', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRefreshedAt(Date.now());
    } catch (e) {
      console.error('refresh feed failed', e);
      setError('Failed to refresh — admin sign-in required.');
    } finally {
      setRefreshing(false);
    }
  };

  const langLabel = (l: 'en' | 'hi' | 'mix') =>
    l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : 'Both (Mix)';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Hash size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Google News Keywords</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Industry Trends · Live Intelligence Feed · News tab
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refreshFeed}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest"
        >
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh feed now
        </button>
      </header>

      <div className="px-5 pt-4 pb-2 text-[11px] font-bold text-slate-500 leading-relaxed">
        Each row is a Google News search. Type a phrase the same way you would
        type it into Google News (e.g. <em>food safety India</em>). The
        <strong> language </strong> column controls whether we fetch the English
        feed, the Hindi feed, or both for that keyword. Disabled keywords stay
        in the list but stop appearing in the public feeds. The Industry Trends
        column refreshes every 10 minutes — hit “Refresh feed now” to bust the
        cache immediately after edits. Each row shows how many headlines the
        last live fetch returned, when that fetch ran, any upstream error, and
        total reader clicks attributable to that keyword.
        {refreshedAt && (
          <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
            <Check size={11} /> Cache cleared
          </span>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700">
          {error}
        </div>
      )}

      {/* Add new */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              New keyword
            </label>
            <input
              type="text"
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addKeyword();
              }}
              placeholder="e.g. food safety India"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Language
            </label>
            <select
              value={draftLanguage}
              onChange={(e) => setDraftLanguage(e.target.value as 'en' | 'hi' | 'mix')}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-400"
            >
              <option value="mix">Both (Mix)</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
          <button
            type="button"
            onClick={addKeyword}
            disabled={!draftKeyword.trim() || savingId === 'new'}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest"
          >
            {savingId === 'new' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Hash size={28} className="mx-auto text-slate-200 mb-3" />
            <p className="text-xs font-bold text-slate-400">
              No keywords configured yet. Add one above to start populating the
              public Google News feeds.
            </p>
          </div>
        ) : (
          items.map((row, idx) => {
            const isEditing = editingId === row.id;
            const isDragging = draggingId === row.id;
            const isDragOver = dragOverId === row.id && draggingId && draggingId !== row.id;
            return (
              <div
                key={row.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  if (isEditing) return;
                  setDraggingId(row.id);
                  e.dataTransfer.effectAllowed = 'move';
                  try { e.dataTransfer.setData('text/plain', row.id); } catch {}
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                onDragOver={(e) => {
                  if (!draggingId || draggingId === row.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverId !== row.id) setDragOverId(row.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === row.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(row.id);
                }}
                className={`px-5 py-3 flex items-center gap-3 hover:bg-slate-50 ${row.enabled ? '' : 'opacity-60'} ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300' : ''}`}
              >
                <div
                  className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                  title="Drag to reorder"
                  aria-hidden="true"
                >
                  <GripVertical size={14} />
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveRow(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    title="Move up"
                    aria-label={`Move ${row.keyword} up`}
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    title="Move down"
                    aria-label={`Move ${row.keyword} down`}
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={editKeyword}
                        onChange={(e) => setEditKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 min-w-[180px] px-2 py-1.5 rounded-lg border border-emerald-300 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                      <select
                        value={editLanguage}
                        onChange={(e) => setEditLanguage(e.target.value as 'en' | 'hi' | 'mix')}
                        className="px-2 py-1.5 rounded-lg border border-emerald-300 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="mix">Both (Mix)</option>
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900 truncate">
                          {row.keyword}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700">
                          {langLabel(row.language)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${row.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {row.enabled ? 'enabled' : 'disabled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold text-slate-500">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100"
                          title={
                            row.last_fetched_at
                              ? `Last fetch: ${new Date(row.last_fetched_at).toLocaleString()}`
                              : 'No fetch recorded yet'
                          }
                        >
                          <Newspaper size={10} />
                          {row.last_result_count ?? 0} headlines
                          <span className="text-slate-400">·</span>
                          <Clock size={10} />
                          {formatRelativeTime(row.last_fetched_at)}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700"
                          title="Reader clicks on Industry Trends articles attributed to this keyword"
                        >
                          <Eye size={10} />
                          {(row.click_count || 0).toLocaleString()} clicks
                        </span>
                        {row.last_error && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 max-w-full"
                            title={`${row.last_error}${row.last_error_at ? `\n(${new Date(row.last_error_at).toLocaleString()})` : ''}`}
                          >
                            <AlertCircle size={10} />
                            <span className="truncate max-w-[260px]">
                              {row.last_error}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={commitEdit}
                        disabled={savingId === row.id}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                        title="Save"
                      >
                        {savingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleEnabled(row)}
                        disabled={savingId === row.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        title={row.enabled ? 'Disable' : 'Enable'}
                      >
                        {row.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => beginEdit(row)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        disabled={savingId === row.id}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// News Media Management
//
// Admin-managed publisher whitelist for the Google News proxy. When
// at least one media row is enabled, the public Industry Trends feed
// (home Live Intelligence Feed + News tab) only shows articles whose
// source domain or publisher name matches one of the configured rows.
// When zero rows are enabled, no publisher filter is applied — every
// result from the keyword searches passes through (the previous,
// pre-feature behaviour). Mirrors NewsKeywordsManagement above so the
// admin experience is consistent.
// ─────────────────────────────────────────────────────────────────────

interface NewsMediaRow {
  id: string;
  name: string;
  domain: string;
  enabled: boolean;
  sort_order: number;
}

function NewsMediaManagement() {
  const [items, setItems] = useState<NewsMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDomain, setDraftDomain] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/academy/news-media', { headers: adminHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(Array.isArray(j?.items) ? j.items : []);
    } catch (e) {
      console.error('reload news media failed', e);
      setItems([]);
      setError('Failed to load — admin sign-in required.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveOne = async (row: Partial<NewsMediaRow> & { id?: string }) => {
    setSavingId(row.id || 'new');
    setError('');
    try {
      const r = await fetch('/api/academy/news-media', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(row),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      console.error('save news media failed', e);
      setError('Failed to save — admin sign-in required.');
    } finally {
      setSavingId(null);
    }
  };

  const addMedia = async () => {
    const name = draftName.trim();
    const domain = draftDomain.trim();
    if (!name && !domain) {
      setError('Enter a publisher name or a domain (or both).');
      return;
    }
    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    await saveOne({ name, domain, enabled: true, sort_order: nextOrder });
    setDraftName('');
    setDraftDomain('');
  };

  const beginEdit = (row: NewsMediaRow) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditDomain(row.domain);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const original = items.find((i) => i.id === editingId);
    if (!original) {
      setEditingId(null);
      return;
    }
    const name = editName.trim();
    const domain = editDomain.trim();
    if (!name && !domain) {
      setError('A publisher needs a name or a domain.');
      return;
    }
    await saveOne({ ...original, name, domain });
    setEditingId(null);
  };

  const toggleEnabled = async (row: NewsMediaRow) => {
    await saveOne({ ...row, enabled: !row.enabled });
  };

  const removeRow = async (row: NewsMediaRow) => {
    if (!confirm(`Delete media source "${row.name || row.domain}"?`)) return;
    setSavingId(row.id);
    setError('');
    try {
      const r = await fetch('/api/academy/news-media', {
        method: 'DELETE',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: row.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      console.error('delete news media failed', e);
      setError('Failed to delete — admin sign-in required.');
    } finally {
      setSavingId(null);
    }
  };

  const moveRow = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    const [m] = reordered.splice(idx, 1);
    reordered.splice(target, 0, m);
    setItems(reordered);
    try {
      const r = await fetch('/api/academy/news-media', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reorder: reordered.map((row, i) => ({ id: row.id, sort_order: i })),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      console.error('reorder news media failed', e);
      setError('Failed to reorder — admin sign-in required.');
      reload();
    }
  };

  const refreshFeed = async () => {
    setRefreshing(true);
    setError('');
    try {
      const r = await fetch('/api/academy/news-media?refresh=1', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRefreshedAt(Date.now());
    } catch (e) {
      console.error('refresh feed failed', e);
      setError('Failed to refresh — admin sign-in required.');
    } finally {
      setRefreshing(false);
    }
  };

  const enabledCount = items.filter((i) => i.enabled).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
            <Globe2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">News Media Sources</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Publisher whitelist · Industry Trends · News tab
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refreshFeed}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest"
        >
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh feed now
        </button>
      </header>

      <div className="px-5 pt-4 pb-2 text-[11px] font-bold text-slate-500 leading-relaxed">
        Add the publishers you trust — by name (e.g. <em>Reuters</em>,{' '}
        <em>The Hindu</em>) and / or by domain (e.g. <em>reuters.com</em>,{' '}
        <em>thehindu.com</em>). When at least one source is enabled, the
        public Industry Trends feed only shows articles from those
        publishers. <strong>Disable or delete every row</strong> to fall
        back to "all publishers" (no filter applied). The 10-minute
        feed cache is busted automatically after every change — hit
        “Refresh feed now” to force-refresh on demand.
        {refreshedAt && (
          <span className="ml-2 inline-flex items-center gap-1 text-sky-600">
            <Check size={11} /> Cache cleared
          </span>
        )}
      </div>

      <div className="px-5 pb-3">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${enabledCount > 0 ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
          {enabledCount > 0 ? (
            <><Check size={11} /> Filter active — {enabledCount} publisher{enabledCount === 1 ? '' : 's'} allowed</>
          ) : (
            <><AlertCircle size={11} /> Filter OFF — every publisher is allowed</>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700">
          {error}
        </div>
      )}

      {/* Add new */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Publisher name
            </label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMedia(); }}
              placeholder="e.g. Reuters"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-sky-400"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Domain
            </label>
            <input
              type="text"
              value={draftDomain}
              onChange={(e) => setDraftDomain(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMedia(); }}
              placeholder="e.g. reuters.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-sky-400"
            />
          </div>
          <button
            type="button"
            onClick={addMedia}
            disabled={(!draftName.trim() && !draftDomain.trim()) || savingId === 'new'}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest"
          >
            {savingId === 'new' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Source
          </button>
        </div>
        <p className="mt-2 text-[10px] font-bold text-slate-400 italic">
          Tip: domain matching is suffix-based, so <em>bbc.com</em> also
          matches <em>news.bbc.com</em>. Either field is enough — add
          both for the safest match.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Globe2 size={28} className="mx-auto text-slate-200 mb-3" />
            <p className="text-xs font-bold text-slate-400">
              No media sources configured yet. Add one above to start
              filtering by publisher — until then every keyword result
              is shown.
            </p>
          </div>
        ) : (
          items.map((row, idx) => {
            const isEditing = editingId === row.id;
            return (
              <div
                key={row.id}
                className={`px-5 py-3 flex items-center gap-3 hover:bg-slate-50 ${row.enabled ? '' : 'opacity-60'}`}
              >
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveRow(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        placeholder="Name"
                        className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg border border-sky-300 text-sm font-bold text-slate-700 focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="text"
                        value={editDomain}
                        onChange={(e) => setEditDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        placeholder="Domain"
                        className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg border border-sky-300 text-sm font-bold text-slate-700 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.domain && (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(row.domain)}&sz=64`}
                          alt=""
                          className="w-4 h-4 rounded-sm shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      {row.name && (
                        <span className="text-sm font-extrabold text-slate-900 truncate">{row.name}</span>
                      )}
                      {row.domain && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider bg-slate-100 text-slate-600 lowercase">
                          {row.domain}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${row.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {row.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={commitEdit}
                        disabled={savingId === row.id}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                        title="Save"
                      >
                        {savingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleEnabled(row)}
                        disabled={savingId === row.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        title={row.enabled ? 'Disable' : 'Enable'}
                      >
                        {row.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => beginEdit(row)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        disabled={savingId === row.id}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Jobs admin — CRUD for the public /jobs board (components/JobsPage.tsx)
// ─────────────────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  salary: string;
  employment: 'Full-time' | 'Contract' | 'Remote';
  area: 'Quality' | 'Production' | 'Regulatory' | 'R&D';
  source: string;
  apply_url: string;
  posted_on: string;
  promoted: boolean;
  status: 'published' | 'draft' | 'pending' | 'inactive';
  description: string;
  requirements: string[];
  skills: string[];
  submitter_name?: string;
  submitter_email?: string;
  submitter_phone?: string;
  submitted_at?: string;
}

const EMPTY_JOB = (): JobRow => ({
  id: '',
  title: '',
  company: '',
  location: '',
  experience: '',
  salary: '',
  employment: 'Full-time',
  area: 'Quality',
  source: '',
  apply_url: '',
  posted_on: new Date().toISOString().slice(0, 10),
  promoted: false,
  status: 'published',
  description: '',
  requirements: [],
  skills: [],
  submitter_name: '',
  submitter_email: '',
  submitter_phone: '',
  submitted_at: '',
});

// Convert a multi-line textarea (one item per line) into a clean
// trimmed array. Empty lines are dropped so a stray return doesn't
// create a blank requirement on the public page.
const linesToArray = (s: string): string[] =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

// Convert a comma-separated chip list into a clean array.
const chipsToArray = (s: string): string[] =>
  s
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);

// Deterministic colour pick for the company-initial avatar so the same
// company always gets the same tile colour across renders.
const JOB_AVATAR_PALETTE = [
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-teal-500',
];
const jobAvatarColor = (s: string) => {
  const str = String(s || '');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return JOB_AVATAR_PALETTE[h % JOB_AVATAR_PALETTE.length];
};

function JobsManagement() {
  const [items, setItems] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<JobRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobRow['status']>('all');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/jobs');
      const j = await r.json();
      const arr: JobRow[] = (Array.isArray(j?.items) ? j.items : []).map((row: any) => ({
        id: String(row.id || ''),
        title: row.title || '',
        company: row.company || '',
        location: row.location || '',
        experience: row.experience || '',
        salary: row.salary || '',
        employment: row.employment === 'Contract' || row.employment === 'Remote' ? row.employment : 'Full-time',
        area: ['Quality', 'Production', 'Regulatory', 'R&D'].includes(row.area) ? row.area : 'Quality',
        source: row.source || '',
        apply_url: row.apply_url || '',
        posted_on: row.posted_on ? String(row.posted_on).slice(0, 10) : new Date().toISOString().slice(0, 10),
        promoted: row.promoted === true,
        status:
          row.status === 'draft' || row.status === 'pending' || row.status === 'inactive'
            ? row.status
            : 'published',
        description: row.description || '',
        requirements: Array.isArray(row.requirements) ? row.requirements : [],
        skills: Array.isArray(row.skills) ? row.skills : [],
        submitter_name: row.submitter_name || '',
        submitter_email: row.submitter_email || '',
        submitter_phone: row.submitter_phone || '',
        submitted_at: row.submitted_at || '',
      }));
      setItems(arr);
    } catch (e) {
      console.error('reload jobs failed', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.company.trim()) {
      setError('Title and Company are required');
      return;
    }
    if (editing.apply_url && !/^https?:\/\//i.test(editing.apply_url)) {
      setError('Apply URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...editing,
        id: editing.id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        posted_on: new Date(editing.posted_on).toISOString(),
      };
      const r = await fetch('/api/jobs', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setEditing(null);
      await reload();
    } catch (e) {
      console.error('save job failed', e);
      setError('Failed to save — admin sign-in required.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: JobRow) => {
    if (!confirm(`Delete "${row.title}" at ${row.company}?`)) return;
    try {
      const r = await fetch('/api/jobs', {
        method: 'DELETE',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: row.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (e) {
      console.error('delete job failed', e);
      setError('Failed to delete — admin sign-in required.');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = items;
    if (statusFilter !== 'all') {
      base = base.filter((j) => j.status === statusFilter);
    }
    if (!q) return base;
    return base.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.area.toLowerCase().includes(q),
    );
  }, [items, search, statusFilter]);

  // Quick approve / set-status: writes the row back via the same admin
  // POST so the API enforces the same sanitisation as a manual edit.
  const setStatus = useCallback(
    async (row: JobRow, next: JobRow['status']) => {
      try {
        const payload = {
          ...row,
          status: next,
          posted_on:
            next === 'published'
              ? new Date().toISOString()
              : new Date(row.posted_on).toISOString(),
        };
        const r = await fetch('/api/jobs', {
          method: 'POST',
          headers: adminHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await reload();
      } catch (e) {
        console.error('set status failed', e);
        setError('Failed to update — admin sign-in required.');
      }
    },
    [reload],
  );

  const pendingCount = useMemo(
    () => items.filter((j) => j.status === 'pending').length,
    [items],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Briefcase size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Jobs Board</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Public /jobs page · admin-managed openings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title / company"
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending review{pendingCount > 0 ? ` (${pendingCount})` : ''}</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="inactive">Deactivated</option>
          </select>
          {pendingCount > 0 && statusFilter !== 'pending' && (
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-widest"
              title="Show submissions awaiting approval"
            >
              {pendingCount} awaiting review
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(EMPTY_JOB());
              setError('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest"
          >
            <Plus size={13} /> Post a job
          </button>
        </div>
      </header>

      {error && (
        <div className="px-5 py-2 bg-rose-50 text-rose-700 text-xs font-bold border-b border-rose-100">
          {error}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No jobs posted yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Click "Post a job" to add the first opening.
            </p>
          </div>
        ) : (
          filtered.map((row) => (
            <div key={row.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
              {/* Company-initial avatar — same colour palette idea as the
                  public board so the admin row visually matches what
                  candidates will see. */}
              <div
                className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black text-white ${
                  jobAvatarColor(row.company)
                }`}
                aria-hidden
              >
                {(row.company || '?').trim().charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-slate-900 truncate">{row.title}</h4>
                  {row.promoted && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-wider">
                      Promoted
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      row.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700'
                        : row.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : row.status === 'inactive'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {row.status === 'pending'
                      ? 'Pending review'
                      : row.status === 'inactive'
                      ? 'Deactivated'
                      : row.status}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{row.company}</p>
                {/* Meta-pill row keeps things scannable at a glance. */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                  {row.location && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      <MapPin size={10} /> {row.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    <Briefcase size={10} /> {row.employment}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                    {row.area}
                  </span>
                  {row.experience && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {row.experience}
                    </span>
                  )}
                  {row.salary && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                      {row.salary}
                    </span>
                  )}
                  {row.source && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 uppercase tracking-wider">
                      via {row.source}
                    </span>
                  )}
                  <span className="text-slate-400 ml-1">
                    {row.posted_on ? new Date(row.posted_on).toLocaleDateString() : '—'}
                  </span>
                </div>
                {row.status === 'pending' && (row.submitter_email || row.submitter_name) && (
                  <p className="text-[11px] text-amber-700 mt-2 font-bold">
                    Submitted by {row.submitter_name || 'anonymous'}
                    {row.submitter_email ? ` · ${row.submitter_email}` : ''}
                    {row.submitter_phone ? ` · ${row.submitter_phone}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {row.status === 'pending' && (
                  <button
                    onClick={() => setStatus(row, 'published')}
                    title="Approve & publish"
                    className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                  >
                    Approve
                  </button>
                )}
                {row.status === 'published' && (
                  <button
                    onClick={() => setStatus(row, 'inactive')}
                    title="Deactivate (hide from public board)"
                    className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase tracking-wider"
                  >
                    Deactivate
                  </button>
                )}
                {row.status === 'inactive' && (
                  <button
                    onClick={() => setStatus(row, 'published')}
                    title="Reactivate & publish"
                    className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                  >
                    Reactivate
                  </button>
                )}
                {row.apply_url && (
                  <a
                    href={row.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open apply URL"
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
                <button
                  onClick={() => {
                    setEditing(row);
                    setError('');
                  }}
                  title="Edit"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => remove(row)}
                  title="Delete"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-sm font-black text-slate-900">
                {editing.id ? 'Edit job' : 'Post a job'}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </header>
            <div className="p-5 space-y-4">
              <JobField label="Job title *">
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  placeholder="Senior Quality Assurance Manager"
                />
              </JobField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <JobField label="Company *">
                  <input
                    type="text"
                    value={editing.company}
                    onChange={(e) => setEditing({ ...editing, company: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="Britannia Industries"
                  />
                </JobField>
                <JobField label="Location">
                  <input
                    type="text"
                    value={editing.location}
                    onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="Bangalore, Karnataka"
                  />
                </JobField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <JobField label="Functional area">
                  <select
                    value={editing.area}
                    onChange={(e) => setEditing({ ...editing, area: e.target.value as JobRow['area'] })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="Quality">Quality</option>
                    <option value="Production">Production</option>
                    <option value="Regulatory">Regulatory</option>
                    <option value="R&D">R&D</option>
                  </select>
                </JobField>
                <JobField label="Employment">
                  <select
                    value={editing.employment}
                    onChange={(e) => setEditing({ ...editing, employment: e.target.value as JobRow['employment'] })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Remote">Remote</option>
                  </select>
                </JobField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <JobField label="Experience">
                  <input
                    type="text"
                    value={editing.experience}
                    onChange={(e) => setEditing({ ...editing, experience: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="8-12 years"
                  />
                </JobField>
                <JobField label="Annual salary">
                  <input
                    type="text"
                    value={editing.salary}
                    onChange={(e) => setEditing({ ...editing, salary: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="₹18-25 LPA"
                  />
                </JobField>
              </div>

              <JobField
                label="Apply URL (LinkedIn, Naukri, company careers page, etc)"
                hint="Where the Apply Now button on the public page should send the candidate. Must start with http:// or https://"
              >
                <input
                  type="url"
                  value={editing.apply_url}
                  onChange={(e) => setEditing({ ...editing, apply_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  placeholder="https://www.linkedin.com/jobs/view/12345"
                />
              </JobField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <JobField label="Source" hint="Where this opening came from. Pick a preset or type a custom value.">
                  <input
                    type="text"
                    list="job-source-presets"
                    value={editing.source}
                    onChange={(e) => setEditing({ ...editing, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="Pick or type…"
                  />
                  <datalist id="job-source-presets">
                    <option value="LinkedIn" />
                    <option value="Naukri" />
                    <option value="Indeed" />
                    <option value="Foundit (Monster)" />
                    <option value="Hirist" />
                    <option value="Instahyre" />
                    <option value="Company Careers Page" />
                    <option value="Referral" />
                    <option value="Recruiter" />
                    <option value="Direct Submission" />
                  </datalist>
                </JobField>
                <JobField label="Posted on">
                  <input
                    type="date"
                    value={editing.posted_on}
                    onChange={(e) => setEditing({ ...editing, posted_on: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </JobField>
              </div>

              <JobField
                label="About this role (description)"
                hint="Plain text. Newlines preserved on the public detail page."
              >
                <textarea
                  rows={5}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-sans"
                  placeholder="Lead the QA function across 4 manufacturing sites…"
                />
              </JobField>

              <JobField
                label="Requirements (one per line)"
                hint="Each line becomes a checkmark bullet on the detail page."
              >
                <textarea
                  rows={4}
                  value={editing.requirements.join('\n')}
                  onChange={(e) =>
                    setEditing({ ...editing, requirements: linesToArray(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-sans"
                  placeholder={'B.Tech / M.Sc. in Food Tech\n8+ years of QA leadership\nFSSC 22000 / HACCP exposure'}
                />
              </JobField>

              <JobField
                label="Skills (comma-separated)"
                hint="Shown as pill chips. Up to 24 skills are stored."
              >
                <input
                  type="text"
                  value={editing.skills.join(', ')}
                  onChange={(e) => setEditing({ ...editing, skills: chipsToArray(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  placeholder="HACCP, FSSC 22000, Internal Audits, CAPA"
                />
              </JobField>

              <div className="flex items-center gap-6 flex-wrap">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editing.promoted}
                    onChange={(e) => setEditing({ ...editing, promoted: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/40"
                  />
                  Promoted (orange badge on the public card)
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span>Status:</span>
                  <select
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as JobRow['status'] })}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="published">Published (live)</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Deactivated</option>
                    {editing.status === 'pending' && (
                      <option value="pending">Pending review</option>
                    )}
                  </select>
                </label>
              </div>
            </div>

            <footer className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Save job
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function JobField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black tracking-[0.18em] text-slate-500 uppercase mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}
