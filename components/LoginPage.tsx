"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AuthState, Entity } from '../types';
import { 
  CheckCircle2, 
  Mail, 
  Lock,
  KeyRound,
  Smartphone,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import Logo from './Logo';

interface LoginPageProps {
  onLogin: (auth: AuthState) => void;
  entities: Entity[];
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, entities }) => {
  const [view, setView] = useState<'login' | 'forgot-password' | 'reset-mpin'>('login');
  const [loginMethod, setLoginMethod] = useState<'password' | 'mpin'>('password');
  
  // Sign-in fields start empty — the user types their credentials
  // manually rather than seeing pre-filled admin defaults.
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [mpin, setMpin] = useState('');
  
  // Forgot Password Flow States
  const [resetStep, setResetStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');

  // Reset MPIN Flow States
  const [newMpin, setNewMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Password visibility + submit-pending state — small UX wins that
  // make the form feel responsive without changing any auth logic.
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Track the failsafe timer so we can clear it on unmount and avoid
  // setting state on an unmounted component in strict mode / dev.
  const submittingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (submittingTimerRef.current) clearTimeout(submittingTimerRef.current);
    };
  }, []);

  const features = [
    "Real-time Compliance Monitoring",
    "Hierarchical Data Management",
    "Automated Regulatory Reporting"
  ];

  const createAdminSession = async (emailAddr: string, pwd: string) => {
    try {
      const res = await fetch('/api/auth/admin-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddr, password: pwd }),
      });
      if (res.ok) {
        const { token } = await res.json();
        if (token) localStorage.setItem('admin_session_token', token);
      }
    } catch {}
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    // Brief pending state so the button visibly reacts even though the
    // mock auth resolves synchronously below. We clear it on the same
    // tick if no onLogin call happens (i.e. failed match).
    setSubmitting(true);
    // Failsafe: ensure the spinner never gets stuck if every branch
    // below early-returns or throws. Stored in a ref so the unmount
    // effect can cancel it on successful login (parent swaps us out).
    if (submittingTimerRef.current) clearTimeout(submittingTimerRef.current);
    submittingTimerRef.current = setTimeout(() => setSubmitting(false), 600);

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.replace(/[^0-9]/g, ''); // Remove non-numeric chars

    // --- Super Admin Mock Logic ---
    if (loginMethod === 'password' && cleanEmail === 'admin@gmail.com' && password === '0000') {
      createAdminSession(cleanEmail, password);
      onLogin({ isLoggedIn: true, scope: 'super-admin', entityId: 'super-admin', userName: 'Admin' });
      return;
    }
    if (loginMethod === 'mpin' && cleanMobile === '9876543210' && mpin === '1234') {
      createAdminSession('admin@gmail.com', '0000');
      onLogin({ isLoggedIn: true, scope: 'super-admin', entityId: 'super-admin', userName: 'Admin' });
      return;
    }

    // --- Auditor Login ---
    if (loginMethod === 'password' && cleanEmail === 'sarah@haccp.com' && password === '1111') {
      // Auditors are admin-tier — mint a session so bulk-email actions work
      // without forcing a second sign-in inside the broadcast modal.
      createAdminSession(cleanEmail, password);
      onLogin({ isLoggedIn: true, scope: 'super-admin', entityId: 'sarah-connor', userName: 'Sarah Connor', email: 'sarah@haccp.com' });
      return;
    }
    if (loginMethod === 'password' && cleanEmail === 'jane@haccp.com' && password === '2222') {
      createAdminSession(cleanEmail, password);
      onLogin({ isLoggedIn: true, scope: 'super-admin', entityId: 'jane-smith', userName: 'Jane Smith', email: 'jane@haccp.com' });
      return;
    }

    // --- Entity Lookup Logic ---
    let foundEntity: Entity | undefined;

    if (loginMethod === 'password') {
      foundEntity = entities.find(e => e.email?.toLowerCase() === cleanEmail);
      if (foundEntity && password === '0000') {
        // Try to mint an admin session too — the API will accept or silently
        // reject based on its configured ADMIN_CREDENTIALS, so non-admin
        // entities just won't get a token (which is correct).
        createAdminSession(cleanEmail, password);
        // Include the entity's email so per-user data (e.g. recipes) is keyed
        // to a unique owner. Without this, every non-super-admin login fell
        // through to a shared 'unknown' owner key and leaked between units.
        onLogin({ isLoggedIn: true, scope: foundEntity.type, entityId: foundEntity.id, email: foundEntity.email?.toLowerCase() || cleanEmail });
        return;
      }
    } else {
      // Fuzzy match phone numbers by stripping formatting from mock data
      foundEntity = entities.find(e => e.phone?.replace(/[^0-9]/g, '') === cleanMobile);
      if (foundEntity && mpin === '1234') {
        onLogin({ isLoggedIn: true, scope: foundEntity.type, entityId: foundEntity.id, email: foundEntity.email?.toLowerCase() });
        return;
      }
    }

    setError(loginMethod === 'password' 
      ? 'Invalid email or password. (Demo: Use 0000)' 
      : 'Invalid mobile number or MPIN. (Demo Mobile: 9876543210 / MPIN: 1234)');
  };

  const handlePasswordResetStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Step 1: Send OTP
    if (resetStep === 1) {
      if (!email) {
        setError("Please enter your registered email address.");
        return;
      }
      setSuccess(`Verification code sent to ${email}`);
      setTimeout(() => {
        setSuccess(null);
        setResetStep(2);
      }, 1500);
    } 
    // Step 2: Verify OTP
    else if (resetStep === 2) {
      if (resetOtp.length !== 6) {
        setError("Please enter a valid 6-digit verification code.");
        return;
      }
      // Simulate verification
      setSuccess("Identity verified successfully.");
      setTimeout(() => {
        setSuccess(null);
        setResetStep(3);
      }, 1000);
    } 
    // Step 3: Set New Password
    else if (resetStep === 3) {
      if (!resetNewPass || !resetConfirmPass) {
        setError("Please fill in all fields.");
        return;
      }
      if (resetNewPass !== resetConfirmPass) {
        setError("Passwords do not match.");
        return;
      }
      if (resetNewPass.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      
      setSuccess("Password updated successfully! Redirecting to login...");
      setTimeout(() => {
        setSuccess(null);
        setView('login');
        setResetStep(1);
        setEmail('');
        setResetOtp('');
        setResetNewPass('');
        setResetConfirmPass('');
      }, 2000);
    }
  };

  const handleMpinReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !newMpin || !confirmMpin) {
      setError("All fields are required.");
      return;
    }
    if (newMpin !== confirmMpin) {
      setError("MPINs do not match.");
      return;
    }
    if (newMpin.length !== 4) {
      setError("MPIN must be 4 digits.");
      return;
    }
    
    setError(null);
    setSuccess(`MPIN successfully updated for ${email}`);
    setTimeout(() => {
      setSuccess(null);
      setView('login');
      setLoginMethod('mpin');
    }, 2000);
  };

  return (
    <div className="h-[100dvh] lg:min-h-screen lg:h-auto bg-[#0f172a] lg:bg-slate-50 flex flex-col lg:items-center lg:justify-center lg:p-8 relative overflow-hidden">
      
      {/* Desktop/Tablet Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl z-0 pointer-events-none hidden lg:block" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl z-0 pointer-events-none hidden lg:block" />

      {/* Mobile: Hero branding area */}
      <div className="lg:hidden bg-[#0f172a] px-6 flex-shrink-0 relative z-10 overflow-hidden"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)', paddingBottom: '28px' }}>
        {/* Decorative blobs — mirror the indigo/emerald palette of the
            desktop hero so the brand feels consistent across breakpoints. */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none translate-y-1/2 -translate-x-1/2" />
        
        <div className="flex items-center gap-3 relative z-10 mb-5">
          <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner">
            <Logo className="w-9 h-9 drop-shadow-lg" />
          </div>
          <div>
            <span className="text-white font-black text-xl tracking-tighter leading-none block">HACCP <span className="text-indigo-400">PRO</span></span>
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-0.5 block">Food Safety Intelligence</span>
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-white leading-tight tracking-tight relative z-10">
          Enterprise Grade<br/>
          <span className="text-indigo-400">Compliance System</span>
        </h1>
        <p className="text-slate-400 text-xs mt-2 font-medium relative z-10 max-w-[260px] leading-relaxed">
          Real-time food safety monitoring across your organization.
        </p>
      </div>

      {/* Desktop card wrapper */}
      <div className="max-w-5xl w-full lg:bg-white lg:rounded-[2.5rem] lg:shadow-2xl overflow-hidden flex flex-col lg:flex-row lg:min-h-[600px] z-10 relative lg:border lg:border-slate-100 flex-1 lg:flex-initial">
        
        {/* Left Side - Information & Features (Desktop only) */}
        <div className="hidden lg:flex lg:w-[45%] bg-[#0f172a] p-12 flex-col justify-between relative overflow-hidden text-left shrink-0">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/20 -rotate-45 translate-x-24 translate-y-24 rounded-full pointer-events-none blur-xl" />
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rotate-12 -translate-x-24 -translate-y-24 rounded-full pointer-events-none blur-xl" />
          
          <div className="relative z-10">
            <div className="flex flex-row items-center justify-start gap-4 mb-10">
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner">
                <Logo className="w-12 h-12 drop-shadow-lg" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white font-black text-2xl tracking-tighter leading-none">HACCP <span className="text-indigo-400">PRO</span></span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Food Safety Intelligence</span>
              </div>
            </div>

            <h1 className="text-4xl font-black text-white leading-tight mb-6 tracking-tight">
              Enterprise Grade<br/><span className="text-indigo-400">Compliance System</span>
            </h1>
            
            <p className="text-slate-400 text-sm leading-relaxed mb-10 font-medium max-w-sm">
              Secure, real-time food safety monitoring across your entire organization hierarchy.
            </p>
          </div>

          <div className="space-y-4 relative z-10">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 group justify-start p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-default">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500 transition-colors shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                </div>
                <span className="text-slate-300 text-xs font-bold uppercase tracking-wide">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Dynamic Auth Forms */}
        <div className="flex-1 px-6 py-5 lg:p-16 flex flex-col justify-center bg-white relative rounded-t-[2rem] lg:rounded-none shadow-[0_-8px_40px_rgba(0,0,0,0.2)] lg:shadow-none">
          
          {/* Notifications */}
          {error && (
             <div className="absolute top-0 left-0 right-0 lg:top-6 lg:left-8 lg:right-8 bg-rose-50 border-b lg:border border-rose-100 text-rose-600 px-4 py-3 lg:rounded-xl text-xs font-bold animate-in slide-in-from-top-2 z-20 flex items-center gap-2 justify-center shadow-sm">
               <ShieldAlert className="w-4 h-4 shrink-0" />
               {error}
             </div>
          )}
          {success && (
             <div className="absolute top-0 left-0 right-0 lg:top-6 lg:left-8 lg:right-8 bg-emerald-50 border-b lg:border border-emerald-100 text-emerald-600 px-4 py-3 lg:rounded-xl text-xs font-bold animate-in slide-in-from-top-2 z-20 flex items-center gap-2 justify-center shadow-sm">
               <CheckCircle2 className="w-4 h-4 shrink-0" />
               {success}
             </div>
          )}

          {/* VIEW: LOGIN */}
          {view === 'login' && (
            <div className="max-w-sm mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center lg:text-left mb-4 lg:mb-8">
                <h2 className="text-xl lg:text-2xl font-black text-slate-900 mb-1 lg:mb-2 tracking-tight">Welcome Back</h2>
                <p className="text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-widest">Sign in to access your dashboard</p>
              </div>

              {/* Login Method Tabs */}
              <div className="flex p-1 lg:p-1.5 bg-slate-100 rounded-xl lg:rounded-2xl mb-4 lg:mb-8 border border-slate-200">
                <button 
                  onClick={() => { setLoginMethod('password'); setError(null); }}
                  className={`flex-1 py-2.5 lg:py-3 text-[10px] font-black uppercase tracking-widest rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 ${loginMethod === 'password' ? 'bg-white text-slate-900 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Password
                </button>
                <button 
                  onClick={() => { setLoginMethod('mpin'); setError(null); }}
                  className={`flex-1 py-2.5 lg:py-3 text-[10px] font-black uppercase tracking-widest rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 ${loginMethod === 'mpin' ? 'bg-white text-slate-900 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  MPIN Access
                </button>
              </div>

              <form onSubmit={handleSignIn} className="space-y-3 lg:space-y-5">
                {loginMethod === 'password' ? (
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 lg:mb-2 ml-1">
                      Email Address
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 p-1 lg:p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full pl-10 lg:pl-12 pr-4 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-800 placeholder:text-slate-300"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 lg:mb-2 ml-1">
                      Mobile Number
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 p-1 lg:p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full pl-10 lg:pl-12 pr-4 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-800 placeholder:text-slate-300"
                        required
                      />
                    </div>
                  </div>
                )}

                {loginMethod === 'password' ? (
                  <div>
                    <div className="flex justify-between items-center mb-1.5 lg:mb-2 ml-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Password
                        </label>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 p-1 lg:p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 lg:pl-12 pr-12 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold tracking-widest text-slate-800 placeholder:text-slate-300"
                        required
                      />
                      {/* Visibility toggle — helps users catch typos on
                          mobile without re-entering the password. */}
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 lg:mb-2 ml-1">
                      4-Digit MPIN
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 p-1 lg:p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        maxLength={4}
                        value={mpin}
                        onChange={(e) => setMpin(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="••••"
                        className="w-full pl-10 lg:pl-12 pr-4 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold tracking-[0.5em] text-center text-slate-800 placeholder:tracking-normal placeholder:text-slate-300"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-1 pt-1 lg:pt-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input type="checkbox" className="peer sr-only" />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors uppercase tracking-wide">Remember</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => { setView(loginMethod === 'password' ? 'forgot-password' : 'reset-mpin'); setError(null); setSuccess(null); }} 
                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-wide hover:underline"
                  >
                    {loginMethod === 'password' ? 'Forgot password?' : 'Reset MPIN?'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-[#0f172a] to-indigo-900 hover:from-indigo-600 hover:to-indigo-700 text-white font-black py-3.5 lg:py-4 rounded-2xl shadow-xl shadow-indigo-900/20 hover:shadow-indigo-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Signing In…
                    </>
                  ) : (
                    <>
                      Secure Sign In <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW: FORGOT PASSWORD (MULTI-STEP) */}
          {view === 'forgot-password' && (
            <div className="max-w-sm mx-auto w-full animate-in slide-in-from-right-8 duration-500">
              <button 
                onClick={() => { setView('login'); setResetStep(1); setError(null); }}
                className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-indigo-600 mb-8 transition-colors uppercase tracking-widest"
              >
                <ChevronLeft className="w-3 h-3" /> Back to Login
              </button>

              <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-emerald-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner mx-auto lg:mx-0 ring-1 ring-indigo-100">
                <ShieldCheck className="w-8 h-8 text-indigo-500" />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight text-center lg:text-left">
                {resetStep === 1 ? "Reset Password" : resetStep === 2 ? "Verify Identity" : "Set New Password"}
              </h2>
              <p className="text-slate-400 text-xs font-bold mb-8 text-center lg:text-left leading-relaxed">
                {resetStep === 1 ? "Enter your registered email address to receive a verification code." : 
                 resetStep === 2 ? `Enter the 6-digit code sent to ${email}` : 
                 "Create a secure password for your account."}
              </p>

              <form onSubmit={handlePasswordResetStep} className="space-y-6">
                {/* Step 1: Email */}
                {resetStep === 1 && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      Email Address
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-800"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: OTP */}
                {resetStep === 2 && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      Verification Code
                    </label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                            <Zap className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            maxLength={6}
                            value={resetOtp}
                            onChange={(e) => setResetOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="123456"
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-lg font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal text-center"
                            autoFocus
                        />
                    </div>
                    <div className="text-center mt-6">
                      <button type="button" onClick={() => { setResetOtp(''); setSuccess("Code resent!"); setTimeout(() => setSuccess(null), 2000); }} className="text-[10px] font-black text-slate-400 hover:text-indigo-500 uppercase tracking-widest transition-colors">Resend Code</button>
                    </div>
                  </div>
                )}

                {/* Step 3: New Passwords */}
                {resetStep === 3 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">New Password</label>
                      <input
                        type="password"
                        value={resetNewPass}
                        onChange={(e) => setResetNewPass(e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-800"
                        placeholder="Min 6 chars"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirm Password</label>
                      <input
                        type="password"
                        value={resetConfirmPass}
                        onChange={(e) => setResetConfirmPass(e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-800"
                        placeholder="Re-enter password"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em]"
                >
                  {resetStep === 1 ? "Send Code" : resetStep === 2 ? "Verify & Proceed" : "Update Password"}
                </button>
              </form>
            </div>
          )}

          {/* VIEW: RESET MPIN */}
          {view === 'reset-mpin' && (
            <div className="max-w-sm mx-auto w-full animate-in slide-in-from-right-8 duration-500">
              <button 
                onClick={() => setView('login')}
                className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-indigo-600 mb-8 transition-colors uppercase tracking-widest"
              >
                <ChevronLeft className="w-3 h-3" /> Back to Login
              </button>

              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner mx-auto lg:mx-0">
                <Smartphone className="w-8 h-8 text-indigo-500" />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight text-center lg:text-left">Reset MPIN</h2>
              <p className="text-slate-400 text-xs font-bold mb-8 text-center lg:text-left leading-relaxed">Verify your identity to set a new 4-digit access PIN.</p>

              <form onSubmit={handleMpinReset} className="space-y-6">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Registered Email
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    New MPIN
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                       <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      maxLength={4}
                      value={newMpin}
                      onChange={(e) => setNewMpin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="••••"
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-lg font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Confirm MPIN
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-500 transition-colors">
                       <ShieldCheck className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      maxLength={4}
                      value={confirmMpin}
                      onChange={(e) => setConfirmMpin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="••••"
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-lg font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em]"
                >
                  Update MPIN
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;