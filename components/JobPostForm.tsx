'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  Briefcase,
  Building2,
  MapPin,
  IndianRupee,
  GraduationCap,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';

type Employment = 'Full-time' | 'Contract' | 'Remote';
type Area = 'Quality' | 'Production' | 'Regulatory' | 'R&D';

interface FormState {
  title: string;
  company: string;
  location: string;
  salary: string;
  experience: string;
  area: Area;
  employment: Employment;
  apply_url: string;
  description: string;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string;
  // honeypot — must stay empty for the submission to succeed
  website: string;
}

const EMPTY: FormState = {
  title: '',
  company: '',
  location: '',
  salary: '',
  experience: '',
  area: 'Quality',
  employment: 'Full-time',
  apply_url: '',
  description: '',
  submitter_name: '',
  submitter_email: '',
  submitter_phone: '',
  website: '',
};

export default function JobPostForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError('');
      setDone(false);
    }
  }, [open]);

  // Lock body scroll while the modal is mounted so the page behind
  // doesn't scroll under the overlay.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (!form.title.trim() || !form.company.trim()) {
      setError('Job title and company name are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.submitter_email)) {
      setError('Please share a valid contact email so we can confirm your post.');
      return;
    }
    if (form.apply_url && !/^https?:\/\//i.test(form.apply_url)) {
      setError('Application link must start with http:// or https://');
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post a job"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-slate-50 rounded-3xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-900 shadow-sm"
        >
          <X className="w-4 h-4" />
        </button>

        {done ? (
          <SuccessState onClose={onClose} email={form.submitter_email} />
        ) : (
          <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
            {/* Header */}
            <div className="px-6 sm:px-10 pt-10 pb-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.18em] text-slate-400 hover:text-slate-700 uppercase mb-6"
              >
                <ChevronLeft className="w-3 h-3" /> Back to Careers
              </button>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-emerald-600 uppercase mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Hiring Specialists
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Find the Best <span className="text-emerald-600">Food Safety</span> Talent
              </h2>
              <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto">
                Submit your opening below. Our team reviews every post within a business day before
                it goes live on the board.
              </p>
            </div>

            {/* Form card */}
            <form onSubmit={submit} className="px-6 sm:px-10 py-8">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  <Field
                    label="Job Title"
                    icon={<Briefcase className="w-4 h-4" />}
                    placeholder="e.g. Quality Assurance Manager"
                    value={form.title}
                    onChange={(v) => set('title', v)}
                    required
                  />
                  <Field
                    label="Company Name"
                    icon={<Building2 className="w-4 h-4" />}
                    placeholder="e.g. Britannia Industries"
                    value={form.company}
                    onChange={(v) => set('company', v)}
                    required
                  />
                  <Field
                    label="Work Location"
                    icon={<MapPin className="w-4 h-4" />}
                    placeholder="e.g. Bangalore, Karnataka"
                    value={form.location}
                    onChange={(v) => set('location', v)}
                  />
                  <Field
                    label="Salary Range (LPA)"
                    icon={<IndianRupee className="w-4 h-4" />}
                    placeholder="e.g. ₹12-16 LPA"
                    value={form.salary}
                    onChange={(v) => set('salary', v)}
                  />
                  <Field
                    label="Experience Required"
                    icon={<GraduationCap className="w-4 h-4" />}
                    placeholder="e.g. 5-8 years"
                    value={form.experience}
                    onChange={(v) => set('experience', v)}
                  />
                  <SelectField
                    label="Functional Category"
                    value={form.area}
                    onChange={(v) => set('area', v as Area)}
                    options={[
                      { value: 'Quality', label: 'Quality / Food Safety' },
                      { value: 'Production', label: 'Production' },
                      { value: 'Regulatory', label: 'Regulatory' },
                      { value: 'R&D', label: 'R&D' },
                    ]}
                  />

                  <div>
                    <Label>Employment Type</Label>
                    <div className="flex items-center gap-2">
                      {(['Full-time', 'Contract', 'Remote'] as Employment[]).map((t) => {
                        const active = form.employment === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => set('employment', t)}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                              active
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field
                    label="Application Link / Email"
                    icon={<Send className="w-4 h-4" />}
                    placeholder="e.g. jobs.company.com/apply"
                    value={form.apply_url}
                    onChange={(v) => set('apply_url', v)}
                  />
                </div>

                <div>
                  <Label>Job Description &amp; Requirements</Label>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Outline the responsibilities, required certifications (e.g. HACCP, ISO 22000), and key qualifications…"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                  />
                </div>

                {/* Contact info */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-[11px] font-black tracking-[0.18em] text-slate-500 uppercase mb-3">
                    Your Contact Details
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Visible only to our admin team. We'll reach out before publishing.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
                    <Field
                      label="Your Name"
                      placeholder="Recruiter or hiring manager"
                      value={form.submitter_name}
                      onChange={(v) => set('submitter_name', v)}
                    />
                    <Field
                      label="Email"
                      type="email"
                      placeholder="you@company.com"
                      value={form.submitter_email}
                      onChange={(v) => set('submitter_email', v)}
                      required
                    />
                    <Field
                      label="Phone (optional)"
                      placeholder="+91…"
                      value={form.submitter_phone}
                      onChange={(v) => set('submitter_phone', v)}
                    />
                  </div>
                </div>

                {/* Honeypot — kept off-screen via inline style so bots
                    filling every field reveal themselves. */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '-9999px',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                  }}
                >
                  <label>
                    Website
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(e) => set('website', e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {error && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold inline-flex items-start gap-2 w-full">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 rounded-xl text-sm font-extrabold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-extrabold shadow-sm transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      Submit for Review <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessState({ onClose, email }: { onClose: () => void; email: string }) {
  return (
    <div className="px-6 sm:px-10 py-16 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">
        Submitted for review
      </h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
        Thanks! Our admin team will review your posting and publish it within a business day.
        {email && (
          <>
            {' '}We'll reach out at <span className="font-bold text-slate-700">{email}</span> if we
            need anything else.
          </>
        )}
      </p>
      <button
        onClick={onClose}
        className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-extrabold"
      >
        Back to jobs
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-black tracking-[0.18em] text-slate-500 uppercase mb-2">
      {children}
    </span>
  );
}

function Field({
  label,
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  icon?: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300">{icon}</span>
        )}
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${
            icon ? 'pl-10' : 'pl-4'
          } pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-white`}
        />
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
