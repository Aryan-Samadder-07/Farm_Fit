'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Sprout, Phone, Lock, User, Mail, ShieldAlert, AlertCircle, RefreshCw, CheckCircle, KeyRound, Send } from 'lucide-react';

export default function SignupPage() {
  const { signupProfessional } = useAuth();
  
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background glowing blobs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 relative z-10">
        <div className="inline-flex bg-violet-500/10 p-3 rounded-2xl border border-violet-500/20 text-violet-400">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-100">
          Professional Signup
        </h2>
        <p className="text-xs text-slate-400">
          Register securely for RSK Expert advisory & administrator consoles
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/40 border border-slate-800/80 px-6 py-8 sm:px-10 rounded-3xl backdrop-blur-md shadow-2xl space-y-6">

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-xs leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!otpSent ? (
            <form onSubmit={handleRequestOtps} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Dr. S. K. Reddy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Designation</label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-xl px-3 py-3 text-sm text-slate-100 focus:outline-none transition cursor-pointer"
                  >
                    <option value="RSK EXPERT">RSK Expert</option>
                    <option value="VILLAGE CHIEF">Village Chief</option>
                    <option value="MANDI HEAD">Mandi Head</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Secure Password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Gmail Address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-violet-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-violet-600/10"
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
              <div className="bg-violet-500/5 border border-violet-500/10 p-3 rounded-xl text-[11px] text-violet-400/80 leading-relaxed space-y-1">
                <CheckCircle className="h-4 w-4 inline mr-1.5 shrink-0" />
                Verification codes dispatched to:
                <div className="pl-5">
                  • Phone: <strong>{phoneNumber}</strong><br />
                  • Email: <strong>{email}</strong>
                </div>
              </div>

              {(demoPhoneOtp || demoEmailOtp) && (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider text-center">Development Mode OTP Fallbacks</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono font-black text-center">
                    <div className="bg-slate-900 p-1.5 rounded border border-slate-850">
                      <span className="text-[8px] text-slate-500 block font-normal">PHONE OTP</span>
                      <span className="text-emerald-400 text-sm tracking-widest">{demoPhoneOtp}</span>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded border border-slate-850">
                      <span className="text-[8px] text-slate-500 block font-normal">EMAIL OTP</span>
                      <span className="text-violet-400 text-sm tracking-widest">{demoEmailOtp}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Phone verification OTP</label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Phone OTP"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition tracking-widest font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Email verification OTP</label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Email OTP"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition tracking-widest font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-400 cursor-pointer pt-1"
              >
                Change registration details
              </button>
            </form>
          )}

          <div className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-bold">
              Sign In
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
