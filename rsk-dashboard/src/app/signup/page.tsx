'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Sprout, Phone, Lock, User, Mail, ShieldAlert, AlertCircle, RefreshCw, CheckCircle, KeyRound, Send, MapPin } from 'lucide-react';
import Script from 'next/script';

export default function SignupPage() {
  const { signupProfessional, signupWithGoogle, loginWithGoogle } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [designation, setDesignation] = useState('RSK EXPERT');
  const [password, setPassword] = useState('');
  
  // OTP Verification Stage
  const [otpSent, setOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [demoPhoneOtp, setDemoPhoneOtp] = useState<string | null>(null);
  const [demoEmailOtp, setDemoEmailOtp] = useState<string | null>(null);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Sign-Up state
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [googleIdToken, setGoogleIdToken] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleRole, setGoogleRole] = useState<'FARMER' | 'PROFESSIONAL'>('PROFESSIONAL');
  const [googleDesignation, setGoogleDesignation] = useState('RSK EXPERT');
  const [googleVillage, setGoogleVillage] = useState('Google Region');
  const [googlePhone, setGooglePhone] = useState('');
  const [googleOtpSent, setGoogleOtpSent] = useState(false);
  const [googleOtpCode, setGoogleOtpCode] = useState('');
  const [googleDemoOtp, setGoogleDemoOtp] = useState<string | null>(null);

  const handleGoogleCredentialResponse = async (response: any) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const idToken = response.credential;
      setGoogleIdToken(idToken);
      
      // 1. Try to log in directly if the account already exists!
      try {
        const loggedIn = await loginWithGoogle(idToken, 'FARMER');
        if (loggedIn) {
          setErrorMsg('Account exists, logging you in...');
          return;
        }
      } catch (loginErr: any) {
        // If 404 (not registered), we proceed. Otherwise show validation warning.
        if (loginErr.message && !loginErr.message.includes('404') && !loginErr.message.includes('not found')) {
          console.log("Direct login check failed, proceeding to register:", loginErr);
        }
      }

      // 2. Decode details if new profile creation is needed
      const payloadBase64 = idToken.split('.')[1];
      const payloadDecoded = JSON.parse(atob(payloadBase64));
      
      setGoogleEmail(payloadDecoded.email || '');
      setGoogleName(payloadDecoded.name || '');
      setShowGooglePrompt(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Google authentication failed to read credential.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initGoogleSignUp = () => {
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "324957144254-knfqnf3njmsfhbjb0qpokckcmsnuhalu.apps.googleusercontent.com",
        callback: handleGoogleCredentialResponse
      });
      (window as any).google.accounts.id.renderButton(
        document.getElementById("google-signup-btn"),
        { theme: "filled_dark", size: "large", text: "signup_with", shape: "rectangular", width: "380" }
      );
    }
  };

  React.useEffect(() => {
    initGoogleSignUp();
    const interval = setInterval(() => {
      if ((window as any).google) {
        initGoogleSignUp();
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleRequestGoogleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googlePhone || !googleEmail) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/google/signup/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: googleEmail, phone_number: googlePhone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to dispatch verification code');

      setGoogleOtpSent(true);
      if (data.demo_otp_fallback) {
        setGoogleDemoOtp(data.demo_otp_fallback);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP dispatch failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteGoogleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOtpCode) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await signupWithGoogle({
        id_token: googleIdToken,
        name: googleName,
        phone_number: googlePhone,
        phone_otp: googleOtpCode,
        role_preference: googleRole,
        designation: googleRole === 'PROFESSIONAL' ? googleDesignation : undefined,
        village_name: googleRole === 'FARMER' ? googleVillage : undefined
      });
      setShowGooglePrompt(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestOtps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !phoneNumber) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const res = await fetch(`${API_BASE}/api/v1/auth/professional/signup/request-otps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to dispatch verification codes');

      setOtpSent(true);
      if (data.demo_phone_otp) setDemoPhoneOtp(data.demo_phone_otp);
      if (data.demo_email_otp) setDemoEmailOtp(data.demo_email_otp);
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP dispatch failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOtp || !emailOtp) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await signupProfessional({
        name,
        email,
        phone_number: phoneNumber,
        designation,
        password,
        phone_otp: phoneOtp,
        email_otp: emailOtp
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please double check verification codes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 relative z-10">
        <div className="inline-flex bg-slate-100 p-3 rounded-2xl border border-slate-200 text-slate-700">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900">
          Professional Signup
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Register securely for RSK Expert advisory & administrator consoles
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white border border-slate-200 px-6 py-8 sm:px-10 rounded-3xl shadow-sm space-y-6">

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-xs leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!otpSent ? (
            <form onSubmit={handleRequestOtps} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Dr. S. K. Reddy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="mt-1 w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none transition cursor-pointer"
                  >
                    <option value="RSK EXPERT">RSK Expert</option>
                    <option value="VILLAGE CHIEF">Village Chief</option>
                    <option value="MANDI HEAD">Mandi Head</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Secure Password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Gmail Address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Sending codes...</>
                ) : (
                  <><Send className="h-4 w-4" /> Dispatch Verification Codes</>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-[11px] text-emerald-700 leading-relaxed space-y-1">
                <CheckCircle className="h-4 w-4 inline mr-1.5 shrink-0 text-emerald-500" />
                Verification codes dispatched to:
                <div className="pl-5">
                  • Phone: <strong>{phoneNumber}</strong><br />
                  • Email: <strong>{email}</strong>
                </div>
              </div>

              {(demoPhoneOtp || demoEmailOtp) && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider text-center">Development Mode OTP Fallbacks</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono font-black text-center">
                    <div className="bg-slate-100 p-1.5 rounded border border-slate-250">
                      <span className="text-[8px] text-slate-500 block font-normal">PHONE OTP</span>
                      <span className="text-slate-900 text-sm tracking-widest">{demoPhoneOtp}</span>
                    </div>
                    <div className="bg-slate-100 p-1.5 rounded border border-slate-250">
                      <span className="text-[8px] text-slate-500 block font-normal">EMAIL OTP</span>
                      <span className="text-slate-900 text-sm tracking-widest">{demoEmailOtp}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Phone verification OTP</label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Phone OTP"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition tracking-widest font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email verification OTP</label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Email OTP"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition tracking-widest font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Creating profile...</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Verify & Complete Register</>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setOtpSent(false); setDemoPhoneOtp(null); setDemoEmailOtp(null); setPhoneOtp(''); setEmailOtp(''); }}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer pt-1"
              >
                Change registration details
              </button>
            </form>
          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-semibold">OR</span>
            </div>
          </div>

          <div className="flex justify-center w-full min-h-[44px]" id="google-signup-btn"></div>

          <div className="text-center text-xs text-slate-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-bold">
              Sign In
            </Link>
          </div>

        </div>
      </div>

      {/* 🛡️ Google Registration & OTP Verification Modal */}
      {showGooglePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button 
              onClick={() => { setShowGooglePrompt(false); setErrorMsg(null); setGoogleOtpSent(false); }} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
            
            <div className="text-center space-y-2">
              <div className="inline-flex bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-slate-700">
                <Sprout className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Google Registration</h3>
              <p className="text-xs text-slate-500 font-medium">Please verify your phone number to complete your profile.</p>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-3.5 rounded-xl flex items-center gap-3 text-xs leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!googleOtpSent ? (
              <form onSubmit={handleRequestGoogleOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={googleEmail}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 focus:outline-none cursor-not-allowed"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Role / Department</label>
                  <select
                    value={googleRole}
                    onChange={(e) => setGoogleRole(e.target.value as any)}
                    className="mt-1 w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none transition cursor-pointer"
                  >
                    <option value="PROFESSIONAL">🛡️ Professional (RSK Expert / Admin)</option>
                    <option value="FARMER">🌾 Farmer Portal</option>
                  </select>
                </div>

                {googleRole === 'PROFESSIONAL' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                    <select
                      value={googleDesignation}
                      onChange={(e) => setGoogleDesignation(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none transition cursor-pointer"
                    >
                      <option value="RSK EXPERT">RSK Expert</option>
                      <option value="VILLAGE CHIEF">Village Chief</option>
                      <option value="MANDI HEAD">Mandi Head</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Village / Mandal</label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Podalakur Mandal"
                        value={googleVillage}
                        onChange={(e) => setGoogleVillage(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={googleName}
                      onChange={(e) => setGoogleName(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="+919876543210"
                      value={googlePhone}
                      onChange={(e) => setGooglePhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Sending verification...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send Verification Code</>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCompleteGoogleSignup} className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-[11px] text-emerald-700 leading-relaxed">
                  Verification code sent to <strong>{googlePhone}</strong>.
                </div>

                {googleDemoOtp && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Development Mode SMS Fallback</span>
                    <span className="text-lg font-mono font-black text-slate-900 tracking-widest">{googleDemoOtp}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Enter Verification Code</label>
                  <div className="relative mt-1">
                    <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={googleOtpCode}
                      onChange={(e) => setGoogleOtpCode(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none transition tracking-widest font-mono"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Finalizing...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" /> Verify & Complete Register</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setGoogleOtpSent(false); setGoogleDemoOtp(null); setGoogleOtpCode(''); }}
                  className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer pt-1"
                >
                  Change registration details
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Official Google Identity Services SDK */}
      <Script 
        src="https://accounts.google.com/gsi/client" 
        onLoad={initGoogleSignUp}
        strategy="afterInteractive"
      />
    </div>
  );
}
