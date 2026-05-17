'use client';

import React, { use, useState, useEffect, useMemo } from 'react';
import { resolveWaContact } from '@/lib/countryDialingCodes';
import {
  GraduationCap, Calendar, Clock, MapPin, User, Mail, Phone,
  Globe, Briefcase, Building2, CheckCircle2, AlertCircle,
  Loader2, ChevronDown, Users, BookOpen, Send, ArrowLeft, Award,
  ArrowRight, Sparkles, Copy, Check, IndianRupee, Smartphone, Tag, Timer,
  Upload, ImageIcon, X as XIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import FloatingCourses from '@/components/FloatingCourses';

function sessionShortCode(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return Math.abs(h).toString(36).padStart(6, '0').slice(0, 6);
}

const PROFESSIONS = ['Student', 'FBO', 'Consultant', 'Others'] as const;
const GENDERS     = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

interface Session {
  id: string;
  topic: string;
  subTopic: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: string;
  location?: string;
  trainer: string;
  description?: string;
  status: string;
  thumbnailImage?: string;
  sampleCertTemplateId?: string;
  whatsappLink?: string;
  instagramLink?: string;
  linkedinLink?: string;
  registrationExpiryDate?: string;
  upiId?: string;
  courseFee?: number;
  discount?: number;
  offerValidTill?: string;
  couponDiscount?: number;
  couponCommission?: number;
}

const COUNTRIES = [
  'India','United States','United Kingdom','Canada','Australia','UAE','Singapore','Malaysia',
  'Germany','France','Netherlands','Japan','South Korea','China','Brazil','South Africa',
  'Kenya','Nigeria','Indonesia','Philippines','Thailand','Vietnam','Bangladesh','Sri Lanka',
  'Nepal','Pakistan','Saudi Arabia','Qatar','Bahrain','Oman','Kuwait','New Zealand',
  'Ireland','Sweden','Norway','Denmark','Finland','Spain','Italy','Portugal','Greece',
  'Other'
];

// ── ParticipantAutofiller ─────────────────────────────────────────────────────
// Renders nothing visible. For a single participant row, watches its
// email/whatsapp and triggers the same two autofill lookups that previously
// only ran for the primary participant: (1) prior-registration lookup by
// email/WA against the same session, (2) LMS profile lookup by mobile.
// Spawning one of these per row makes corporate bookings autofill every
// participant card independently.
interface AutofillSourceItem {
  data?: {
    name?: string; gender?: string; country?: string; profession?: string;
    instituteName?: string; designation?: string; whatsapp?: string; email?: string;
  };
}
interface AutofillResponse  { items?: AutofillSourceItem[]; }
interface LmsResponse       { items?: { name?: string; email?: string }[]; }

interface AutofillerProps {
  index:           number;
  email:           string;
  whatsapp:        string;
  sessionLoaded:   boolean;
  sessionId:       string;
  onPatch:         (idx: number, patch: Partial<{
    name: string; gender: string; whatsapp: string; email: string;
    country: string; profession: string; instituteName: string; designation: string;
  }>) => void;
  onLoadingChange: (idx: number, loading: boolean) => void;
  onLmsFilled:     (idx: number, filled: boolean)  => void;
}

const ParticipantAutofiller: React.FC<AutofillerProps> = ({
  index, email, whatsapp, sessionLoaded, sessionId, onPatch, onLoadingChange, onLmsFilled,
}) => {
  // Prior-registration lookup (debounced).
  useEffect(() => {
    const e = email.trim();
    const w = whatsapp.trim();
    if (!sessionLoaded || (!e && !w)) return;
    const t = setTimeout(async () => {
      onLoadingChange(index, true);
      try {
        const params = new URLSearchParams();
        params.set('sessionId', sessionId);
        if (e) params.set('email', e);
        if (w) params.set('whatsapp', w);
        const res = await fetch(`/api/training-register?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as AutofillResponse;
        const item = data.items?.[0];
        if (item?.data) onPatch(index, item.data);
      } catch {}
      onLoadingChange(index, false);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, sessionId, email, whatsapp, index]);

  // LMS profile autofill by mobile.
  useEffect(() => {
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10) { onLmsFilled(index, false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lms?phone=${encodeURIComponent(digits)}`);
        if (!res.ok) return;
        const data = (await res.json()) as LmsResponse;
        const user = data.items?.[0];
        if (!user) return;
        onPatch(index, { name: user.name, email: user.email });
        onLmsFilled(index, true);
      } catch {}
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsapp, index]);

  return null;
};

export default function TraineeRegistrationPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);

  const [session, setSession]       = useState<Session | null>(null);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [paidRegistration, setPaidRegistration] = useState(false);
  const [error, setError]           = useState('');
  const [showSampleCert, setShowSampleCert] = useState(false);
  const [sampleCertPreview, setSampleCertPreview] = useState<any>(null);
  const [upiCopied, setUpiCopied] = useState(false);
  const [paymentImage, setPaymentImage] = useState<string>('');
  const [utrNumber, setUtrNumber] = useState('');
  const paymentImgRef = React.useRef<HTMLInputElement>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [featuredSession, setFeaturedSession] = useState<Session | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    error?: string;
    discount_percent?: number;
    discount_amount?: number;
    commission_amount?: number;
    uses_remaining?: number;
    final_price?: number;
    owner_name?: string;
    coupon_id?: string;
    owner_id?: string;
  } | null>(null);
  const [showPromo, setShowPromo]             = useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [myCouponCode, setMyCouponCode]           = useState<string | null>(null);
  const [myCouponCommission, setMyCouponCommission] = useState<number | null>(null);
  const [myCouponDiscount, setMyCouponDiscount]     = useState<number | null>(null);
  const [myCouponActiveFrom, setMyCouponActiveFrom] = useState<string | null>(null);
  const [myCouponExpiresAt, setMyCouponExpiresAt]   = useState<string | null>(null);
  const [couponCopied, setCouponCopied]             = useState(false);

  const validateCoupon = async (code: string) => {
    if (!code.trim()) { setCouponResult(null); return; }
    const fee = session?.courseFee || 0;
    if (fee <= 0) return;
    setCouponValidating(true);
    try {
      const res = await fetch('/api/academy/affiliate-coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), course_price: fee }),
      });
      const data = await res.json();
      setCouponResult(data);
    } catch { setCouponResult({ valid: false, error: 'Network error' }); }
    setCouponValidating(false);
  };

  // Each participant carries the full field set so corporate bookings can
  // override per-row (different person, different designation, etc.).
  interface ParticipantForm {
    name:          string;
    gender:        string;
    whatsapp:      string;
    email:         string;
    country:       string;
    profession:    string;
    instituteName: string;
    designation:   string;
  }
  const blankParticipant = (): ParticipantForm => ({
    name: '', gender: '', whatsapp: '', email: '',
    country: '', profession: '', instituteName: '', designation: '',
  });
  const [participants, setParticipants] = useState<ParticipantForm[]>([blankParticipant()]);
  const participantCount = participants.length;

  // Legacy `form.*` references still resolve to participant 0.
  const form = useMemo(() => participants[0] ?? blankParticipant(), [participants]);

  useEffect(() => {
    const load = async () => {
      try {
        const [calRes, settingsRes] = await Promise.all([
          fetch('/api/training-calendar'),
          fetch('/api/app-settings?key=featured_popup_session_id'),
        ]);
        if (!calRes.ok) throw new Error();
        const data = await calRes.json();
        const allSessions: Session[] = data.items || [];
        const found = allSessions.find((s: Session) => s.id === sessionId);
        const now = new Date();
        const others = allSessions.filter((s: Session) =>
          s.id !== sessionId &&
          (s as any).isActive === true &&
          (!( s as any).registrationExpiryDate || new Date((s as any).registrationExpiryDate + 'T23:59:59') >= now)
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setUpcomingSessions(others);
        // Set the featured popup session (admin-chosen). Skip if the
        // chosen session has been deactivated (isActive === false) so
        // the marketing popup never advertises a session the admin
        // has explicitly hidden from public surfaces.
        if (settingsRes.ok) {
          const sData = await settingsRes.json();
          const featId = sData.value || null;
          if (featId) {
            const feat = allSessions.find((s: Session) => s.id === featId) || null;
            if (feat && (feat as any).isActive !== false) {
              setFeaturedSession(feat);
            }
          }
        }
        // Treat deactivated sessions as "not found" on the public
        // registration page — admin intent is that they shouldn't be
        // visible publicly. Without this check, a stale link to a
        // deactivated session would still render the full registration
        // form (the "logout view" leak).
        if (found && (found as any).isActive === false) {
          setNotFound(true);
        } else if (found) {
          setSession(found);
          fetch('/api/training-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          }).catch(() => {});
          if (found.sampleCertTemplateId) {
            const endpoints = ['/api/cert-templates', '/api/lm-cert-templates'];
            for (const ep of endpoints) {
              try {
                const tRes = await fetch(ep);
                if (!tRes.ok) continue;
                const tData = await tRes.json();
                const tmpl = (tData.items || []).find((t: any) => t.id === found.sampleCertTemplateId);
                if (tmpl) { setSampleCertPreview(tmpl); break; }
              } catch { /* skip */ }
            }
          }
        } else setNotFound(true);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    load();
  }, [sessionId]);

  // Per-participant autofill state — one entry per row index. Loading is
  // shown inline next to the participant card; lmsAutoFilled drives a one-
  // line confirmation under the primary participant only (kept that way to
  // avoid noisy stacked banners on corporate bookings).
  const [rowAutofillLoading, setRowAutofillLoading] = useState<Record<number, boolean>>({});
  const [rowLmsFilled,       setRowLmsFilled]       = useState<Record<number, boolean>>({});
  // Legacy banner reads — primary participant only.
  const autoFillLoading = !!rowAutofillLoading[0];
  const lmsAutoFilled   = !!rowLmsFilled[0];

  // ── Promo popup disabled ─────────────────────────────────────────────────
  // The auto-firing "Free Webinar" promo popup was suppressing the page and
  // covered content the visitor was actively trying to read. Removed per
  // product request — the FloatingCourses training-courses panel below now
  // serves the same cross-promotion role without hijacking the screen.

  const dismissPromo = () => {
    sessionStorage.setItem(`promo_seen_${sessionId}`, '1');
    setShowPromo(false);
  };

  const scrollToForm = () => {
    dismissPromo();
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const needsInstitute = form.profession === 'Student' || form.profession === 'FBO';

  const waResolution = useMemo(
    () => resolveWaContact(form.whatsapp, { country: form.country }),
    [form.whatsapp, form.country]
  );
  const whatsappTrimmed = form.whatsapp.trim();
  const whatsappInvalid = whatsappTrimmed.length > 0 && (waResolution.url === null || waResolution.invalid === true);

  const SHARED_FIELDS: (keyof ParticipantForm)[] = ['country', 'profession', 'instituteName', 'designation'];

  // Legacy `set(field, val)` — always targets participant 0. Preserves the
  // auto-clear of instituteName when profession switches away from Student/FBO.
  const set = (field: string, val: string) => setP(0, field as keyof ParticipantForm, val);

  const setP = (index: number, field: keyof ParticipantForm, val: string) => {
    setParticipants(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const next: ParticipantForm = { ...p, [field]: val };
      if (field === 'profession' && val !== 'Student' && val !== 'FBO') {
        next.instituteName = '';
      }
      return next;
    }));
  };

  // Pull generic (non-personal) fields off whatever rows are filled, in order
  // of recency. New rows inherit those values so corporate bookings don't
  // require re-entering country/profession/etc. for every participant.
  const inferGenericPrefill = (rows: ParticipantForm[]): Partial<ParticipantForm> => {
    const out: Partial<ParticipantForm> = {};
    for (let i = rows.length - 1; i >= 0; i--) {
      for (const f of SHARED_FIELDS) {
        if (!out[f] && rows[i][f]) out[f] = rows[i][f];
      }
    }
    return out;
  };

  const setCount = (n: number) => {
    const target = Math.max(1, Math.min(25, Math.floor(n)));
    setParticipants(prev => {
      if (target === prev.length) return prev;
      if (target > prev.length) {
        const prefill = inferGenericPrefill(prev);
        const additions = Array.from({ length: target - prev.length }, () => ({
          ...blankParticipant(),
          ...prefill,
        }));
        return [...prev, ...additions];
      }
      return prev.slice(0, target);
    });
  };

  // Merge an autofill payload into a single participant row. Used by the
  // per-row ParticipantAutofiller below; existing values always win so the
  // user's typed input is never clobbered.
  const mergeIntoParticipant = (idx: number, patch: Partial<ParticipantForm>) => {
    setParticipants(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const merged: ParticipantForm = {
        name:          p.name          || (patch.name          ?? ''),
        gender:        p.gender        || (patch.gender        ?? ''),
        whatsapp:      p.whatsapp      || (patch.whatsapp      ?? ''),
        email:         p.email         || (patch.email         ?? ''),
        country:       p.country       || (patch.country       ?? ''),
        profession:    p.profession    || (patch.profession    ?? ''),
        instituteName: p.instituteName || (patch.instituteName ?? ''),
        designation:   p.designation   || (patch.designation   ?? ''),
      };
      return merged;
    }));
  };

  // Per-row validation memo — block-local errors + aggregate validity for
  // gating the submit button.
  const rowErrors = useMemo(() => participants.map(p => {
    if (!p.name.trim() || !p.email.trim()) return 'Full name and email are required.';
    if (!p.whatsapp.trim()) return 'Mobile number is required.';
    const wa = resolveWaContact(p.whatsapp, { country: p.country });
    if (wa.url === null || wa.invalid === true) {
      return "That mobile number doesn't match any recognised country format. Please include the country code (e.g. +91 98765 43210).";
    }
    if (!p.gender) return 'Please select a gender.';
    if (!p.country) return 'Please select a country.';
    if (!p.profession) return 'Please select a profession.';
    if ((p.profession === 'Student' || p.profession === 'FBO') && !p.instituteName.trim()) {
      return p.profession === 'Student' ? 'Please enter the institute / college name.' : 'Please enter the FBO name.';
    }
    return null;
  }), [participants]);
  const allRowsValid = rowErrors.every(e => e === null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Block-local errors are already rendered inline; surface the first
    // failing row in the global banner too so the user gets a nudge.
    const firstBad = rowErrors.findIndex(err => err !== null);
    if (firstBad >= 0) {
      const label = participants.length > 1 ? ` for participant #${firstBad + 1}` : '';
      setError(`${rowErrors[firstBad]}${label ? ` (${label.trim()})` : ''}`);
      return;
    }
    if (session?.upiId && !paymentImage) { setError('Please upload your payment screenshot as proof of payment.'); return; }
    if (session?.upiId && !utrNumber.trim()) { setError('Please enter the UPI Transaction Reference Number (UTR) from your payment.'); return; }
    if (session?.upiId && utrNumber.trim().length < 8) { setError('UTR number seems too short. Please enter the complete transaction reference number.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/training-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionTitle: session?.topic,
          sessionDate:  session?.date,
          // New batch shape; server still accepts the legacy single-payload shape.
          // Each participant carries its own full field set so the server can
          // persist per-row overrides (different country, designation, etc.).
          participants: participants.map(p => ({
            name:          p.name.trim(),
            gender:        p.gender,
            whatsapp:      p.whatsapp.trim(),
            email:         p.email.trim(),
            country:       p.country,
            profession:    p.profession,
            instituteName: p.instituteName.trim(),
            designation:   p.designation.trim(),
          })),
          ...(paymentImage ? { paymentScreenshot: paymentImage, utrNumber: utrNumber.trim(), paymentStatus: 'pending' } : {}),
          ...(couponCode.trim() && couponResult?.valid ? {
            couponCode: couponCode.trim().toUpperCase(),
            couponDiscount: couponResult.discount_amount || 0,
            couponOwnerId: couponResult.owner_id || '',
          } : {}),
        }),
      });
      const resData = await res.json();
      if (!res.ok) { setError(resData.error || 'Server error'); setSubmitting(false); return; }
      if (resData.myCouponCode)       setMyCouponCode(resData.myCouponCode);
      if (resData.myCouponCommission) setMyCouponCommission(resData.myCouponCommission);
      if (resData.myCouponDiscount)   setMyCouponDiscount(resData.myCouponDiscount);
      if (resData.myCouponActiveFrom) setMyCouponActiveFrom(resData.myCouponActiveFrom);
      if (resData.myCouponExpiresAt)  setMyCouponExpiresAt(resData.myCouponExpiresAt);
      setPaidRegistration(!!utrNumber.trim());
      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    }
    setSubmitting(false);
  };

  const canUseInstitute = form.profession === 'Student' || form.profession === 'FBO';

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="text-indigo-500 animate-spin" />
        <p className="text-sm font-bold text-slate-400">Loading session…</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={36} className="text-rose-500" />
        </div>
        <h1 className="text-xl font-black text-slate-800 mb-2">Session Not Found</h1>
        <p className="text-sm text-slate-400">This registration link is invalid or the training session no longer exists.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-3">Thank You for Registering!</h1>

        {paidRegistration ? (
          <>
            <p className="text-sm text-slate-600 mb-2">
              Your registration for <span className="font-bold text-slate-800">{session?.topic}</span> has been received.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Your payment is currently under verification. Once verified, a confirmation email
              {((session?.couponCommission ?? 0) > 0 || (session?.couponDiscount ?? 0) > 0)
                ? <> along with your <span className="font-semibold text-violet-600">Refer &amp; Earn coupon</span></>
                : null
              }{' '}will be sent to your registered email address.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-2">
              Your registration for <span className="font-bold text-slate-800">{session?.topic}</span> has been received.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              A confirmation email has been sent to your registered email address. Please check your inbox (and spam folder, just in case).
            </p>
          </>
        )}

        <div className="bg-slate-50 rounded-2xl p-4 text-left text-sm text-slate-600 space-y-2 mb-4">
          <p className="font-black text-slate-700 text-[10px] uppercase tracking-widest mb-2">Need Help?</p>
          <p>📧 <span className="font-semibold">Email:</span> safefoodmitra@gmail.com</p>
          <p>📞 <span className="font-semibold">Phone:</span> +91 82390 08202 / +91 96105 23566</p>
        </div>
      </div>
    </div>
  );

  const modeColors: Record<string, string> = {
    Classroom: 'bg-blue-100 text-blue-700',
    Online:    'bg-violet-100 text-violet-700',
    Recorded:  'bg-amber-100 text-amber-700',
    Demo:      'bg-emerald-100 text-emerald-700',
  };

  const isExpired = !!session?.registrationExpiryDate &&
    new Date(session.registrationExpiryDate + 'T23:59:59') < new Date();

  const SocialLinks = () => (
    (session?.whatsappLink || session?.instagramLink || session?.linkedinLink) ? (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mb-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Join Us</p>
        <div className="flex flex-wrap gap-2">
          {session?.whatsappLink && (
            <a href={session.whatsappLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 hover:bg-[#25D366] hover:text-white text-[#25D366] transition-all text-xs font-black uppercase tracking-wider">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.849L0 24l6.336-1.498A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.491-5.19-1.352l-.372-.22-3.763.889.944-3.657-.241-.381A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              WhatsApp Group
            </a>
          )}
          {session?.instagramLink && (
            <a href={session.instagramLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-pink-200 bg-pink-50 hover:bg-gradient-to-br hover:from-[#f09433] hover:to-[#bc1888] hover:text-white text-pink-600 transition-all text-xs font-black uppercase tracking-wider">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              Instagram
            </a>
          )}
          {session?.linkedinLink && (
            <a href={session.linkedinLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#0A66C2]/30 bg-[#0A66C2]/10 hover:bg-[#0A66C2] hover:text-white text-[#0A66C2] transition-all text-xs font-black uppercase tracking-wider">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              LinkedIn
            </a>
          )}
        </div>
      </div>
    ) : null
  );

  const modeColors2: Record<string, string> = {
    Classroom: 'bg-blue-100 text-blue-700',
    Online:    'bg-violet-100 text-violet-700',
    Recorded:  'bg-amber-100 text-amber-700',
    Demo:      'bg-emerald-100 text-emerald-700',
  };

  const UpcomingPromo = () => upcomingSessions.length === 0 ? null : (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
          <Sparkles size={14} className="text-white" />
        </div>
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Also Upcoming</p>
      </div>
      <div className="space-y-4">
        {upcomingSessions.map(s => {
          const regUrl = `/r/${sessionShortCode(s.id)}`;
          const dateLabel = s.date ? new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          const timeLabel = s.startTime ? `${s.startTime}${s.endTime ? ` – ${s.endTime}` : ''}` : '';
          return (
            <a key={s.id} href={regUrl}
              className="block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all group active:scale-[0.99]">
              {s.thumbnailImage && (
                <div className="relative overflow-hidden">
                  <img src={s.thumbnailImage} alt={s.topic} className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-black text-sm leading-tight truncate drop-shadow">{s.topic}</p>
                      {s.subTopic && <p className="text-white/80 text-[10px] font-semibold truncate">{s.subTopic}</p>}
                    </div>
                    <div className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg">
                      Register <ArrowRight size={11} />
                    </div>
                  </div>
                </div>
              )}
              <div className={`p-4 flex items-center justify-between gap-3 ${s.thumbnailImage ? 'border-t border-slate-100' : ''}`}>
                {!s.thumbnailImage && (
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">{s.topic}</p>
                    {s.subTopic && <p className="text-[10px] text-slate-500 font-semibold truncate">{s.subTopic}</p>}
                  </div>
                )}
                <div className={`flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-bold ${s.thumbnailImage ? 'flex-1' : ''}`}>
                  {dateLabel && <span className="flex items-center gap-1"><Calendar size={11} className="text-indigo-400" />{dateLabel}</span>}
                  {timeLabel && <span className="flex items-center gap-1"><Clock size={11} className="text-indigo-400" />{timeLabel}</span>}
                  {s.mode && <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${modeColors2[s.mode] || 'bg-slate-100 text-slate-500'}`}>{s.mode}</span>}
                </div>
                {s.thumbnailImage && (
                  <div className="shrink-0 p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ArrowRight size={16} />
                  </div>
                )}
                {!s.thumbnailImage && (
                  <div className="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    Register <ArrowRight size={11} />
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );

  if (isExpired) return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-rose-50 via-white to-orange-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shrink-0">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">HACCP PRO · LMS</p>
            <h1 className="text-base font-black text-slate-800 leading-tight">Trainee Registration</h1>
          </div>
        </div>
        {session?.thumbnailImage && (
          <div className="w-full rounded-3xl overflow-hidden mb-6 shadow-lg border border-slate-200">
            <img src={session.thumbnailImage} alt={session.topic} className="w-full h-auto block" />
          </div>
        )}
        <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-8 mb-6 text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={30} className="text-rose-500" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Registration Closed</h2>
          <p className="text-sm text-slate-500 mb-1">
            The registration for <span className="font-bold text-slate-700">{session?.topic}</span> has expired.
          </p>
          <p className="text-sm text-slate-400">Please join one of our upcoming trainings through the links below.</p>
        </div>
        <SocialLinks />
        <p className="text-center text-[10px] text-slate-300 font-bold mt-8 uppercase tracking-widest">Powered by HACCP PRO · LMS</p>
      </div>
      <FloatingCourses />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-50 via-white to-violet-50 py-8 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shrink-0">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">HACCP PRO · LMS</p>
            <h1 className="text-base font-black text-slate-800 leading-tight">Trainee Registration</h1>
          </div>
        </div>

        {/* Session info card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          {session?.thumbnailImage && (
            <div className="w-full overflow-hidden">
              <img src={session.thumbnailImage} alt={session.topic} className="w-full h-auto block" />
            </div>
          )}
          <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Training Session</p>
              <h2 className="text-lg font-black text-slate-900 leading-tight">{session?.topic}</h2>
              {session?.subTopic && <p className="text-xs text-slate-500 mt-0.5 font-semibold">{session.subTopic}</p>}
            </div>
            {session?.mode && (
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shrink-0 ${modeColors[session.mode] || 'bg-slate-100 text-slate-500'}`}>
                {session.mode}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {session?.date && (
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar size={13} className="text-indigo-400 shrink-0" />
                <span className="font-semibold">{new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
            {session?.startTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock size={13} className="text-indigo-400 shrink-0" />
                <span className="font-semibold">{session.startTime}{session.endTime ? ` – ${session.endTime}` : ''}</span>
              </div>
            )}
            {session?.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin size={13} className="text-indigo-400 shrink-0" />
                <span className="font-semibold truncate">{session.location}</span>
              </div>
            )}
            {session?.trainer && (
              <div className="flex items-center gap-2 text-slate-600">
                <User size={13} className="text-indigo-400 shrink-0" />
                <span className="font-semibold truncate">{session.trainer}</span>
              </div>
            )}
          </div>
          {session?.description && (
            <p className="mt-3 text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">{session.description}</p>
          )}

          {/* Pricing banner inside session info card */}
          {session?.courseFee && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-center flex-wrap gap-3">
                {session.discount && session.discount > 0 ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-emerald-700">₹{(session.courseFee - session.discount).toLocaleString('en-IN')}</span>
                      <span className="text-sm font-bold text-slate-400 line-through">₹{session.courseFee.toLocaleString('en-IN')}</span>
                    </div>
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-wider">
                      <Tag size={11} /> Save ₹{session.discount.toLocaleString('en-IN')}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-black text-violet-700">₹{session.courseFee.toLocaleString('en-IN')}</span>
                )}
                {session.offerValidTill && (
                  <span className="flex items-center gap-1 ml-auto text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl uppercase tracking-wider">
                    <Timer size={11} /> Offer ends {new Date(session.offerValidTill + 'T23:59:59').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
          )}

          {session?.sampleCertTemplateId && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setShowSampleCert(!showSampleCert)} className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-all">
                <Award size={13} /> {showSampleCert ? 'Hide' : 'View'} Sample Certificate
              </button>
              {showSampleCert && sampleCertPreview && (
                <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="relative w-full rounded-2xl overflow-hidden border border-indigo-100 shadow-sm" style={{ aspectRatio: '794/562' }}>
                    {sampleCertPreview.bgImage && <img src={sampleCertPreview.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0" style={{ background: sampleCertPreview.bgImage ? 'transparent' : (sampleCertPreview.bgColor || '#ffffff') }}>
                      {(sampleCertPreview.elements || []).map((el: any) => (
                        <div key={el.id} style={{
                          position: 'absolute',
                          left: `${(el.x / 794) * 100}%`, top: `${(el.y / 562) * 100}%`,
                          width: `${(el.w / 794) * 100}%`, height: `${(el.h / 562) * 100}%`,
                          fontSize: `${(el.fontSize || 16) * 0.6}px`,
                          fontFamily: el.fontFamily || 'Arial',
                          color: el.color || '#000',
                          fontWeight: el.bold ? 'bold' : 'normal',
                          fontStyle: el.italic ? 'italic' : 'normal',
                          textAlign: el.align || 'left',
                          display: 'flex', alignItems: 'center', justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
                          opacity: el.opacity ?? 1,
                          overflow: 'hidden',
                        }}>
                          {el.type === 'text' && <span>{(el.content || '').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => {
                            const sampleVars: Record<string, string> = { name: 'Your Name', topic: session?.topic || 'Training', trainer: session?.trainer || 'Trainer', date: 'Date', certId: 'CERT-XXXXX', org: 'Organization', designation: 'Designation', timeFrom: '09:00', timeTo: '17:00', location: session?.location || 'Venue' };
                            return sampleVars[k] || `{{${k}}}`;
                          })}</span>}
                          {el.type === 'image' && el.src && <img src={el.src} alt="" className="w-full h-full" style={{ objectFit: el.objectFit || 'contain' }} />}
                          {el.type === 'shape' && el.shapeType === 'rect' && <div className="w-full h-full" style={{ background: el.bgColor || 'transparent', border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000'}` : 'none', borderRadius: el.borderRadius || 0 }} />}
                          {el.type === 'shape' && el.shapeType === 'circle' && <div className="w-full h-full rounded-full" style={{ background: el.bgColor || 'transparent', border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000'}` : 'none' }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-2 text-center">Sample certificate preview — actual details will vary</p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <SocialLinks />

        {/* Participant count selector — moved ABOVE the payment block so the
            calculated batch total reacts to it before the user pays. */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-indigo-500 shrink-0" />
            <div>
              <p className="text-[11px] font-black text-slate-700 leading-none">Number of participants</p>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5">Registering for a team? Add multiple participants in one go.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setCount(participantCount - 1)}
              disabled={participantCount <= 1}
              aria-label="Remove one participant"
              className="w-8 h-8 rounded-lg text-indigo-600 font-black text-sm hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >−</button>
            <input
              type="number"
              min={1}
              max={25}
              value={participantCount}
              onChange={e => setCount(Number(e.target.value) || 1)}
              aria-label="Number of participants"
              className="w-12 text-center text-sm font-black text-slate-800 border-0 outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={() => setCount(participantCount + 1)}
              disabled={participantCount >= 50}
              aria-label="Add another participant"
              className="w-8 h-8 rounded-lg text-indigo-600 font-black text-sm hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >+</button>
          </div>
        </div>

        {/* UPI Payment Section */}
        {session?.upiId && (() => {
          const fee = session.courseFee || 0;
          const disc = session.discount || 0;
          const couponDisc = couponResult?.valid ? (couponResult.discount_amount || 0) : 0;
          // Per-seat after offer discount; coupon applies ONCE to the batch total.
          const perSeat = fee > 0 ? Math.max(0, fee - disc) : 0;
          const subtotal = perSeat * participantCount;
          const finalAmt = fee > 0 ? Math.max(0, subtotal - couponDisc) : 0;
          const upiLink = `upi://pay?pa=${encodeURIComponent(session.upiId)}&pn=${encodeURIComponent(session.topic)}&am=${finalAmt || ''}&cu=INR`;
          const offerExpired = session.offerValidTill ? new Date(session.offerValidTill + 'T23:59:59') < new Date() : false;
          return (
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl border border-violet-200 shadow-sm overflow-hidden mb-6">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-violet-600 flex items-center justify-center shadow shrink-0">
                  <IndianRupee size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Paid Session</p>
                  <p className="text-sm font-black text-slate-800 leading-tight">Complete Payment to Enroll</p>
                </div>
              </div>

              {/* Referral / Coupon Code inside paid session card */}
              {fee > 0 && (
                <div className="mx-6 mb-4 bg-white rounded-2xl border border-violet-100 p-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Referral / Coupon Code</p>
                  <p className="text-[10px] text-slate-400 font-bold mb-3">Have a referral code? Enter it below to get a discount.</p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={couponCode}
                        onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                        placeholder="E.G. JOHN123"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => validateCoupon(couponCode)}
                      disabled={!couponCode.trim() || couponValidating}
                      className="shrink-0 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {couponValidating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Apply
                    </button>
                  </div>
                  {couponResult && (
                    couponResult.valid ? (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700">
                          <CheckCircle2 size={13} className="shrink-0" />
                          Coupon applied successfully!
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">You Save</p>
                            <p className="text-sm font-black text-emerald-700">₹{(couponResult.discount_amount || 0).toLocaleString('en-IN')} off</p>
                          </div>
                          {(couponResult.commission_amount ?? 0) > 0 && (
                            <div className="bg-white rounded-lg px-3 py-2 border border-violet-100">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Code Owner Earns</p>
                              <p className="text-sm font-black text-violet-700">₹{(couponResult.commission_amount || 0).toLocaleString('en-IN')} / use</p>
                            </div>
                          )}
                          {(couponResult.uses_remaining ?? 0) > 0 && (
                            <div className="bg-white rounded-lg px-3 py-2 border border-amber-100">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Uses Left on Code</p>
                              <p className="text-sm font-black text-amber-700">{couponResult.uses_remaining} remaining</p>
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium pt-0.5">
                          After registering, you'll receive your own referral coupon — share it with friends to earn commissions on future sessions.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{couponResult.error || 'Invalid coupon code'}</span>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Pricing row */}
              {fee > 0 && (
                <div className="mx-6 mb-4 bg-white rounded-2xl border border-violet-100 p-4">
                  <div className="flex items-center flex-wrap gap-3">
                    {(disc > 0 || couponDisc > 0) ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-emerald-700">₹{finalAmt.toLocaleString('en-IN')}</span>
                          <span className="text-base font-bold text-slate-400 line-through">₹{(fee * participantCount).toLocaleString('en-IN')}</span>
                        </div>
                        {disc > 0 && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            <Tag size={11} /> Save ₹{(disc * participantCount).toLocaleString('en-IN')}
                          </span>
                        )}
                        {couponDisc > 0 && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            <Tag size={11} /> Coupon −₹{couponDisc.toLocaleString('en-IN')}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-3xl font-black text-violet-700">₹{(fee * participantCount).toLocaleString('en-IN')}</span>
                    )}
                    {session.offerValidTill && (
                      <span className={`flex items-center gap-1 ml-auto text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider border ${offerExpired ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
                        <Timer size={11} />
                        {offerExpired ? 'Offer Expired' : `Offer ends ${new Date(session.offerValidTill + 'T23:59:59').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </span>
                    )}
                  </div>
                  {participantCount > 1 && (
                    <div className="mt-3 pt-3 border-t border-violet-100 text-[11px] font-bold text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Users size={12} className="text-violet-500" />
                      <span>₹{perSeat.toLocaleString('en-IN')} <span className="text-slate-400">per seat</span></span>
                      <span className="text-slate-400">×</span>
                      <span>{participantCount} participants</span>
                      <span className="text-slate-400">=</span>
                      <span className="font-black text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
                      {couponDisc > 0 && (
                        <span className="text-violet-700">− ₹{couponDisc.toLocaleString('en-IN')} coupon</span>
                      )}
                      <span className="text-slate-400">→ Total payable</span>
                      <span className="font-black text-emerald-700">₹{finalAmt.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* QR Code + UPI ID */}
              <div className="mx-6 mb-4 bg-white rounded-2xl border border-violet-100 p-4 flex flex-col sm:flex-row items-center gap-5">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="p-3 bg-white border-2 border-violet-200 rounded-2xl shadow-sm">
                    <QRCodeSVG
                      value={upiLink}
                      size={130}
                      bgColor="#ffffff"
                      fgColor="#4f46e5"
                      level="M"
                    />
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Scan with any UPI app</p>
                </div>
                <div className="flex-1 w-full">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pay to UPI ID</p>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="text-sm font-black text-slate-800 flex-1 break-all">{session.upiId}</p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(session!.upiId!);
                        setUpiCopied(true);
                        setTimeout(() => setUpiCopied(false), 2000);
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 transition-all text-[10px] font-black uppercase tracking-wider"
                    >
                      {upiCopied ? <Check size={13} /> : <Copy size={13} />}
                      {upiCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <a
                    href={upiLink}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-200 transition-all active:scale-[0.98]"
                  >
                    <Smartphone size={15} /> Open UPI App & Pay
                  </a>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-bold text-center px-6 pb-5 leading-relaxed">
                Scan the QR or tap "Open UPI App" · PhonePe · Google Pay · Paytm · BHIM · Any UPI app<br/>
                After payment, fill the registration form below.
              </p>
            </div>
          );
        })()}

        {/* Registration Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
          {/* UTR Number + Payment screenshot upload — moved to the TOP of the
              form (just below the payment block above) so users complete proof
              of payment before filling in participant details. */}
          {session?.upiId && (
            <div className="pb-2 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  UPI Transaction Reference (UTR) <span className="text-rose-500">*</span>
                </label>
                <p className="text-[10px] text-slate-400 font-bold mb-2">Enter the 12-digit UTR number from your payment confirmation. You can find it in your UPI app under transaction details.</p>
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={e => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                    placeholder="E.G. 432112345678"
                    maxLength={30}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-sm font-bold tracking-widest focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all uppercase"
                  />
                </div>
                {utrNumber.length > 0 && utrNumber.length < 8 && (
                  <p className="mt-1 text-[9px] font-bold text-amber-500 flex items-center gap-1"><AlertCircle size={10} /> UTR should be at least 8 characters</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Payment Screenshot <span className="text-rose-500">*</span>
                </label>
                <p className="text-[10px] text-slate-400 font-bold mb-3">Upload a screenshot of your UPI payment as proof of payment.</p>
                <input
                  ref={paymentImgRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { setError('Payment screenshot must be under 5MB.'); return; }
                    const reader = new FileReader();
                    reader.onload = () => setPaymentImage(reader.result as string);
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
                {paymentImage ? (
                  <div className="relative group rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-sm">
                    <img src={paymentImage} alt="Payment proof" className="w-full max-h-64 object-contain bg-slate-50" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                      <button type="button" onClick={() => paymentImgRef.current?.click()}
                        className="px-4 py-2 bg-white text-slate-700 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-slate-50">
                        Change
                      </button>
                      <button type="button" onClick={() => setPaymentImage('')}
                        className="px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-rose-600 flex items-center gap-1">
                        <XIcon size={12} /> Remove
                      </button>
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                      <Check size={10} /> Uploaded
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => paymentImgRef.current?.click()}
                    className="w-full h-28 border-2 border-dashed border-violet-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-violet-400 hover:border-violet-400 hover:bg-violet-50/50 transition-all cursor-pointer group">
                    <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-all">
                      <ImageIcon size={20} className="text-violet-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Tap to Upload Screenshot</span>
                    <span className="text-[9px] font-bold text-slate-300">JPG · PNG · Max 5MB</span>
                  </button>
                )}
              </div>
              <div className="border-b border-slate-100" />
            </div>
          )}

          {/* Per-participant blocks */}
          {participants.map((p, idx) => {
            const isPrimary = idx === 0;
            const pWa = resolveWaContact(p.whatsapp, { country: p.country });
            const pWaInvalid = p.whatsapp.trim().length > 0 && (pWa.url === null || pWa.invalid === true);
            const errId = `whatsapp-error-${idx}`;
            return (
              <div key={idx} className={`${idx > 0 ? 'border-t border-slate-100 pt-4' : ''} space-y-3`}>
                <ParticipantAutofiller
                  index={idx}
                  email={p.email}
                  whatsapp={p.whatsapp}
                  sessionLoaded={!!session}
                  sessionId={sessionId}
                  onPatch={mergeIntoParticipant}
                  onLoadingChange={(i, l) => setRowAutofillLoading(prev => ({ ...prev, [i]: l }))}
                  onLmsFilled={(i, f) => setRowLmsFilled(prev => ({ ...prev, [i]: f }))}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black">{idx + 1}</span>
                    {isPrimary ? (participantCount > 1 ? 'Primary Participant' : 'Your Details') : `Participant ${idx + 1}`}
                  </p>
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => setParticipants(prev => prev.filter((_, i) => i !== idx))}
                      className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest"
                      aria-label={`Remove participant ${idx + 1}`}
                    >Remove</button>
                  )}
                </div>

                {/* Mobile + Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${pWaInvalid ? 'text-rose-400' : 'text-slate-300'}`} />
                      <input type="tel" required value={p.whatsapp} onChange={e => setP(idx, 'whatsapp', e.target.value)}
                        placeholder="+91 98765 43210"
                        aria-invalid={pWaInvalid || undefined}
                        aria-describedby={pWaInvalid ? errId : undefined}
                        className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm outline-none transition-all ${pWaInvalid ? 'border-rose-300 focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 bg-rose-50/40' : 'border-slate-200 focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400'}`} />
                    </div>
                    {pWaInvalid && (
                      <p id={errId} className="mt-1 flex items-start gap-1 text-[10px] font-bold text-rose-600">
                        <AlertCircle size={11} className="shrink-0 mt-0.5" />
                        <span>That number doesn&apos;t match any recognised country format. Please include the country code (e.g. +91 98765 43210).</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input type="email" required value={p.email} onChange={e => setP(idx, 'email', e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" />
                    </div>
                  </div>
                </div>

                {/* Name + Gender */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input type="text" required value={p.name} onChange={e => setP(idx, 'name', e.target.value)}
                        placeholder="Enter full name"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {GENDERS.map(g => (
                        <button type="button" key={g} onClick={() => setP(idx, 'gender', g)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${p.gender === g ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Country + Profession */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      <select required value={p.country} onChange={e => setP(idx, 'country', e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none appearance-none bg-white transition-all">
                        <option value="">Select country…</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Profession <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PROFESSIONS.map(prof => (
                        <button type="button" key={prof} onClick={() => setP(idx, 'profession', prof)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${p.profession === prof ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                          {prof === 'Student'    && <BookOpen size={11} />}
                          {prof === 'FBO'        && <Building2 size={11} />}
                          {prof === 'Consultant' && <Briefcase size={11} />}
                          {prof === 'Others'     && <Users size={11} />}
                          {prof}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Designation</label>
                  <div className="relative">
                    <Briefcase size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input type="text" value={p.designation} onChange={e => setP(idx, 'designation', e.target.value)}
                      placeholder="e.g. Quality Manager, Food Safety Officer"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" />
                  </div>
                </div>

                {/* Institute / FBO — conditional */}
                {(p.profession === 'Student' || p.profession === 'FBO') && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      {p.profession === 'Student' ? 'Institute / College Name' : 'FBO Name'} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input type="text" required value={p.instituteName} onChange={e => setP(idx, 'instituteName', e.target.value)}
                        placeholder={p.profession === 'Student' ? 'e.g. ABC College of Sciences' : 'e.g. Acme Foods Pvt Ltd'}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" />
                    </div>
                  </div>
                )}

                {/* Block-local validation banner — surfaces the first
                    actionable error for THIS participant inline. */}
                {rowErrors[idx] && (
                  <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                    <AlertCircle size={11} className="shrink-0 mt-0.5" />
                    <span>{rowErrors[idx]}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Autofill feedback */}
          {autoFillLoading && (
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Looking up saved trainee details…</p>
          )}
          {lmsAutoFilled && !autoFillLoading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-500 text-sm">✓</span>
              <p className="text-[11px] font-bold text-emerald-700">Details auto-filled from your HACCP PRO profile. Please verify and complete any missing fields.</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !allRowsValid}
            title={!allRowsValid ? 'Please complete every participant\'s required fields before submitting.' : undefined}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]">
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Submitting…</> : <><Send size={16} /> Register Now</>}
          </button>

          <p className="text-center text-[10px] text-slate-400">
            By registering, you consent to your details being used for training administration purposes.
          </p>
        </form>

        <p className="text-center text-[10px] text-slate-300 font-bold mt-8 uppercase tracking-widest">Powered by HACCP PRO · LMS</p>
      </div>

      {/* Cross-sell: same training-courses panel that runs on the news pages
          and on /n/<token> share landings. Floats over the page so visitors
          can browse the full priced course catalogue without losing their
          place in the registration flow. */}
      <FloatingCourses />

      {/* ── Promo Popup ─────────────────────────────────────────────────────────── */}
      {showPromo && (() => {
        const popupSession = featuredSession || session;
        const isSameSession = !featuredSession || featuredSession.id === sessionId;
        const handleRegisterClick = () => {
          dismissPromo();
          if (isSameSession) {
            setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
          } else {
            window.location.href = `/training-register/${popupSession!.id}`;
          }
        };
        return popupSession && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={e => { if (e.target === e.currentTarget) dismissPromo(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismissPromo} />

          {/* Card — bottom sheet on mobile, centered modal on desktop */}
          <div className="relative w-full md:max-w-lg bg-white md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

            {/* Close button */}
            <button
              onClick={dismissPromo}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all backdrop-blur-sm"
              aria-label="Close"
            >
              <XIcon size={14} />
            </button>

            {/* Banner image / gradient header */}
            {popupSession.thumbnailImage ? (
              <div className="relative shrink-0">
                <img src={popupSession.thumbnailImage} alt={popupSession.topic} className="w-full object-contain max-h-72" />
              </div>
            ) : (
              <div className="h-28 bg-gradient-to-br from-indigo-600 to-violet-700 flex items-end p-4 shrink-0">
                <div>
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-0.5">Limited Seats Available</p>
                  <h2 className="text-base font-black text-white leading-snug">{popupSession.topic}</h2>
                  {popupSession.subTopic && <p className="text-xs text-white/80 font-semibold mt-0.5">{popupSession.subTopic}</p>}
                </div>
              </div>
            )}

            {/* Body */}
            <div className="overflow-y-auto p-5 space-y-4">

              {/* Key details */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <Calendar size={13} className="text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Date</p>
                    <p className="text-xs font-black text-slate-700">
                      {new Date(popupSession.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <Clock size={13} className="text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Time</p>
                    <p className="text-xs font-black text-slate-700">{popupSession.startTime} – {popupSession.endTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <MapPin size={13} className="text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Mode</p>
                    <p className="text-xs font-black text-slate-700">{popupSession.mode}{popupSession.location ? ` · ${popupSession.location}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <User size={13} className="text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Trainer</p>
                    <p className="text-xs font-black text-slate-700 truncate">{popupSession.trainer}</p>
                  </div>
                </div>
              </div>

              {/* Key Highlights */}
              {popupSession.description && (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-3">
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">What You'll Learn</p>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-4">{popupSession.description}</p>
                </div>
              )}

              {/* Fee */}
              {(popupSession.courseFee ?? 0) > 0 && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Course Fee</p>
                    {popupSession.discount && popupSession.discount > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-indigo-700">₹{((popupSession.courseFee ?? 0) - popupSession.discount).toLocaleString('en-IN')}</span>
                        <span className="text-sm text-slate-400 line-through">₹{(popupSession.courseFee ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                    ) : (
                      <span className="text-xl font-black text-indigo-700">₹{(popupSession.courseFee ?? 0).toLocaleString('en-IN')}</span>
                    )}
                    {popupSession.offerValidTill && <p className="text-[9px] font-bold text-rose-500 mt-0.5">Offer valid till {popupSession.offerValidTill}</p>}
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    <IndianRupee size={18} className="text-indigo-600" />
                  </div>
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRegisterClick}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 transition-all active:scale-[0.98]"
                >
                  <Send size={14} /> Register Now
                </button>
                <button
                  onClick={dismissPromo}
                  className="px-4 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
