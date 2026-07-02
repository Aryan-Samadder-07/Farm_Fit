'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { auth } from '../../lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { Sprout, Phone, Lock, User, MapPin, Send, CheckCircle, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const { loginFarmer, loginFarmerFirebase, loginProfessional } = useAuth();
  
  // Auth Mode: 'FARMER' | 'PROFESSIONAL'
  const [roleMode, setRoleMode] = useState<'FARMER' | 'PROFESSIONAL'>('FARMER');
  
  // Form State
  const [name, setName] = useState('');
  const [villageName, setVillageName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // OTP Verification State (Farmers)
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if Firebase is running in mock mode
  const isMockFirebase = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-api-key';

  const handleRequestFarmerOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (isMockFirebase) {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
        const res = await fetch(`${API_BASE}/api/v1/auth/farmer/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: phoneNumber })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');
        
        setOtpSent(true);
        if (data.demo_otp_fallback) {
          setDemoOtp(data.demo_otp_fallback);
        }
      } else {
        // Real Google Firebase Phone Authentication
        const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
        const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
        setConfirmationResult(confirmation);
        setOtpSent(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP dispatch failed. Make sure to specify the country code prefix (e.g. +91 for India).');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFarmerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (isMockFirebase) {
        await loginFarmer(name, villageName, phoneNumber, otpCode);
      } else {
        // Verify code with Google Firebase
        const result = await confirmationResult.confirm(otpCode);
        const idToken = await result.user.getIdToken();
        // Send verified ID Token to backend to complete session setup
        await loginFarmerFirebase(name, villageName, idToken);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check your code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfessionalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await loginProfessional(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid credentials or connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background glowing blobs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 relative z-10">
        <div className="inline-flex bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-400">
          <Sprout className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-100">
          Kisan Alert AI
        </h2>
        <p className="text-xs text-slate-400">
          National Agricultural Intelligence & Expert System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/40 border border-slate-800/80 px-6 py-8 sm:px-10 rounded-3xl backdrop-blur-md shadow-2xl space-y-6">
          
          {/* Role Toggle Selector */}
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-900">
            <button
              onClick={() => { setRoleMode('FARMER'); setErrorMsg(null); setOtpSent(false); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                roleMode === 'FARMER'
                  ? 'bg-slate-900 text-emerald-400 shadow-md border border-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🌾 Farmer Login
            </button>
            <button
              onClick={() => { setRoleMode('PROFESSIONAL'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                roleMode === 'PROFESSIONAL'
                  ? 'bg-slate-900 text-violet-400 shadow-md border border-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🛡️ Professional Portal
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-xs leading-relaxed animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 🌾 Farmer Registration & Login Form */}
          {roleMode === 'FARMER' && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleRequestFarmerOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Farmer Name</label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Ramesh Kurva"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Village / Mandal</label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Podalakur Mandal"
                        value={villageName}
                        onChange={(e) => setVillageName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
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
                        className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Dispatching OTP...</>
                    ) : (
                      <><Send className="h-4 w-4" /> Send Verification OTP</>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleFarmerLogin} className="space-y-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl text-[11px] text-emerald-400/80 leading-relaxed">
                    <CheckCircle className="h-4 w-4 inline mr-1.5 shrink-0" />
                    OTP verification code dispatched to <strong>{phoneNumber}</strong>.
                  </div>

                  {demoOtp && (
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-center space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Development Mode SMS Fallback</span>
                      <span className="text-lg font-mono font-black text-emerald-400 tracking-widest">{demoOtp}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Enter 6-Digit OTP</label>
                    <div className="relative mt-1">
                      <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition tracking-widest font-mono"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Verifying...</>
                    ) : (
                      <><CheckCircle className="h-4 w-4" /> Verify & Access Portal</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setDemoOtp(null); setOtpCode(''); }}
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-400 cursor-pointer pt-1"
                  >
                    Change phone number or details
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 🛡️ Professional Portal Login Form */}
          {roleMode === 'PROFESSIONAL' && (
            <form onSubmit={handleProfessionalLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="expert@rsk.ap.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-violet-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none transition"
                    required
                  />
                </div>
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
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Pipelining credentials...</>
                ) : (
                  <><Lock className="h-4 w-4" /> Sign In securely</>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-400">
                Are you a government worker?{' '}
                <Link href="/signup" className="text-violet-400 hover:text-violet-300 font-bold">
                  Register Professional Portal
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
      
      {/* Invisible reCAPTCHA container required for Firebase Phone Auth */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
