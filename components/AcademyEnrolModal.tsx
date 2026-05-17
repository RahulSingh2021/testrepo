'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';

// Lightweight enrol form that posts a public lead to
// /api/academy/public-enrolments. Used from the course detail page when
// a visitor clicks "Buy now" on an Academy course (no login required).
// Training Calendar items don't use this — they go straight to the
// existing /training-register/[sessionId] checkout page instead.

export interface AcademyEnrolCourse {
  id: string;
  title?: string;
}

export default function AcademyEnrolModal({
  course,
  onClose,
}: {
  course: AcademyEnrolCourse;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Please fill in your name and email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/academy/public-enrolments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: course.id,
          course_title: course.title,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Could not register. Please try again.');
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Could not register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="mt-4 text-xl font-extrabold text-slate-900">You&rsquo;re registered!</h3>
            <p className="mt-2 text-sm text-slate-500">
              Thanks for showing interest in <strong>{course.title}</strong>. Our team will reach
              out shortly with next steps.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
              Register for
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-slate-900 leading-snug">
              {course.title}
            </h3>
            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                  Full name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                  Phone
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-400 outline-none resize-none"
                />
              </div>
            </div>
            {error && (
              <p className="mt-3 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/30"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Registering…' : 'Confirm Registration'}
            </button>
            <p className="mt-3 text-[11px] text-slate-400 text-center">
              By registering you agree to be contacted about this course.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
