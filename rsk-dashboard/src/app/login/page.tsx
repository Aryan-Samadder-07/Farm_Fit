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
          body: JSON.stringify({ phone_number: phoneNumber, channel: 'sms' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');
        
        setOtpSent(true);
        const code = data.otp || data.demo_otp_fallback;
        if (code) {
          setDemoOtp(code);
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="inline-flex bg-slate-900 p-3 rounded-xl text-white">
          <Sprout className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Kisan Alert AI
        </h2>
        <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">
          National Agricultural Intelligence & Expert System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 px-8 py-8 rounded-xl shadow-xs space-y-5">

          {/* Role Toggle Selector */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => { setRoleMode('FARMER'); setErrorMsg(null); setOtpSent(false); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition cursor-pointer ${
                roleMode === 'FARMER'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🌾 Farmer Login
            </button>
            <button
              onClick={() => { setRoleMode('PROFESSIONAL'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition cursor-pointer ${
                roleMode === 'PROFESSIONAL'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🛡️ Professional Portal
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg flex items-center gap-3 text-xs leading-relaxed animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 🌾 Farmer Registration & Login Form */}
          {roleMode === 'FARMER' && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleRequestFarmerOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Farmer Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Ramesh Kurva"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Village / Mandal</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Podalakur Mandal"
                        value={villageName}
                        onChange={(e) => setVillageName(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="+919876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
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
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-[11px] text-emerald-700 leading-relaxed">
                    <CheckCircle className="h-4 w-4 inline mr-1.5 shrink-0 text-emerald-500" />
                    OTP verification code dispatched to <strong>{phoneNumber}</strong>.
                  </div>

                  {demoOtp && (
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Development Mode Fallback OTP</span>
                      <span className="text-xl font-mono font-black text-slate-900 tracking-widest">{demoOtp}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Enter 6-Digit OTP</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition tracking-widest font-mono"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
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
                    className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer pt-1"
                  >
                    ← Change phone number or details
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 🛡️ Professional Portal Login Form */}
          {roleMode === 'PROFESSIONAL' && (
            <form onSubmit={handleProfessionalLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="expert@rsk.ap.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
              >
                {isSubmitting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Signing in...</>
                ) : (
                  <><Lock className="h-4 w-4" /> Sign In</>
                )}
              </button>

              <div className="pt-1 text-center text-xs text-slate-400">
                Government worker?{' '}
                <Link href="/signup" className="text-slate-700 hover:text-slate-900 font-bold underline underline-offset-2">
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
