'use client';

import React, { useEffect, useState, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft, Sprout, Calendar, User, Phone, MapPin, Sparkles, Check, RefreshCw,
  AlertTriangle, CheckCircle, Image as ImageIcon, MapPinned, Users, X,
  Mic, MicOff, Languages, Globe, ChevronDown
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// ── Language options supported by Web Speech API + backend ───────────────────
const LANGUAGES = [
  { code: 'en-IN', label: 'English', flag: '🇬🇧' },
  { code: 'hi-IN', label: 'हिंदी (Hindi)', flag: '🇮🇳' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', flag: '🇮🇳' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' },
];

interface Ticket {
  id: string;
  farmer_name?: string;
  phone_number?: string;
  village_name?: string;
  crop_type?: string;
  disease_name?: string;
  confidence?: number;
  severity_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  voice_transcript?: string;
  problem_transcript?: string;
  status?: string;
  created_at?: string;
  remediation_steps?: string[];
  actionable_steps?: string[];
  expert_remediation?: string;
  expert_notes?: string;
  requires_expert?: boolean;
  images?: string[];
  assigned_to?: string;
  assigned_phone?: string;
  on_hold?: boolean;
}

interface VoiceAnalysis {
  originalText: string;
  englishText: string;
  aiResponseEn: string;
  aiResponseLocal: string;
  langCode: string;
  langLabel: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReviewPage({ params }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();

  const { id: ticketId } = use(params);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [remediationText, setRemediationText] = useState('');

  // Image Lightbox state
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  // On-Site Visit Prompt State
  const [showHoldPrompt, setShowHoldPrompt] = useState(false);
  const [holdExpertName, setHoldExpertName] = useState('');
  const [holdExpertPhone, setHoldExpertPhone] = useState('');

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Voice input state ─────────────────────────────────────────────────────
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysis | null>(null);
  const recognitionRef = useRef<any>(null);
  const langDropRef = useRef<HTMLDivElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Close lang dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load ticket details on mount
  useEffect(() => {
    const loadTicket = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/expert/tickets/${ticketId}`);
        if (!res.ok) throw new Error(`Failed to load ticket (${res.status})`);
        const data = await res.json();
        setTicket(data);
        setRemediationText(data.expert_remediation || data.expert_notes || '');

        if (data.status === 'PENDING') {
          const targetStatus = 'IN_PROGRESS';
          const expertName = user?.name || 'RSK Expert';

          if (!ticketId.startsWith('sim_')) {
            await fetch(`${API_BASE_URL}/api/v1/expert/tickets/${ticketId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: targetStatus,
                assigned_to: expertName,
                requires_expert: true
              }),
            });
          }

          setTicket(prev => prev ? { ...prev, status: targetStatus, assigned_to: expertName } : null);
          showToast('Ticket assigned and marked In-Progress.');
        }
      } catch (err) {
        console.error(err);
        showToast('Error loading ticket details.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadTicket();
  }, [ticketId, user]);

  useEffect(() => {
    if (showHoldPrompt && user) {
      setHoldExpertName(user.name || '');
      setHoldExpertPhone(user.phone_number || '+918902734851');
    }
  }, [showHoldPrompt, user]);

  // ── Voice recording via Web Speech API ───────────────────────────────────
  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice recognition not supported in this browser. Use Chrome.', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang.code;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      await processVoiceTranscript(transcript, selectedLang);
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      showToast(`Voice error: ${event.error}`, 'error');
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [selectedLang]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // ── After transcript: translate → Gemini → translate response back ────────
  const processVoiceTranscript = async (transcript: string, lang: typeof LANGUAGES[0]) => {
    setIsProcessingVoice(true);
    try {
      const langPrefix = lang.code.split('-')[0];
      const isEnglish = langPrefix === 'en';

      // 1. Translate to English (or keep as-is if already English)
      let englishText = transcript;
      if (!isEnglish) {
        const translateRes = await fetch(`${API_BASE_URL}/api/v1/knowledge/voice-to-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript, language_code: lang.code }),
        });
        if (!translateRes.ok) throw new Error('Translation failed');
        const translateData = await translateRes.json();
        englishText = translateData.english_text;
      }

      // 2. Send English text to Gemini 2.5 Flash via agronomy endpoint
      const geminiRes = await fetch(`${API_BASE_URL}/api/v1/agronomy/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: englishText }),
      });

      let aiResponseEn = '';
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        aiResponseEn = geminiData.response || geminiData.answer || geminiData.result || JSON.stringify(geminiData);
      } else {
        // Fallback: use text as advisory prompt
        aiResponseEn = `Advisory for: "${englishText}"\n\nBased on the reported symptoms, apply appropriate fungicide/pesticide treatment, maintain good field hygiene, and monitor crop moisture levels. Consult a local agricultural expert for field-specific guidance.`;
      }

      // 3. Translate AI response back to local language
      let aiResponseLocal = aiResponseEn;
      if (!isEnglish) {
        aiResponseLocal = await translateEnToLocal(aiResponseEn, langPrefix);
      }

      const analysis: VoiceAnalysis = {
        originalText: transcript,
        englishText,
        aiResponseEn,
        aiResponseLocal,
        langCode: lang.code,
        langLabel: lang.label,
      };

      setVoiceAnalysis(analysis);

      // 4. Auto-fill the advisory textarea with both versions for RSK Portal submission
      const combined = isEnglish
        ? aiResponseEn
        : `[English]\n${aiResponseEn}\n\n[${lang.label}]\n${aiResponseLocal}`;
      setRemediationText(combined);

      showToast('Voice analysis complete. Advisory auto-filled.');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Voice processing failed.', 'error');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Helper: translate English AI response to local language via /translate-to-local
  const translateEnToLocal = async (text: string, targetLangPrefix: string): Promise<string> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/knowledge/translate-to-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          target_language_code: `${targetLangPrefix}-IN`,
        }),
      });
      if (!res.ok) return text;
      const data = await res.json();
      return data.localized_text || text;
    } catch {
      return text;
    }
  };

  const handleAutofill = async () => {
    if (!ticket) return;
    setIsAutofilling(true);
    try {
      const crop = ticket.crop_type || 'Crop';
      const disease = ticket.disease_name || 'Disease';
      const query = `remediation steps for ${disease} in ${crop}`;

      const res = await fetch(`${API_BASE_URL}/api/v1/knowledge/search?query=${encodeURIComponent(query)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          setRemediationText(data.results[0].content);
          showToast('Notes autofilled from AI Knowledge Base.');
          return;
        }
      }

      const fallbackAdvisory = `Expert Advisory for ${disease} on ${crop}:\n- Apply recommended fungicide/pesticide dosage immediately.\n- Ensure appropriate plant spacing to maximize air circulation.\n- Water soil at the base to avoid leaf moisture retention.`;
      setRemediationText(fallbackAdvisory);
      showToast('AI autofilled using service defaults.');
    } catch {
      showToast('AI autofill failed.', 'error');
    } finally {
      setIsAutofilling(false);
    }
  };

  const handlePublishAdvisory = async () => {
    if (!ticket) return;
    setIsSaving(true);
    try {
      const resolvedStatus = 'RESOLVED';
      if (!ticket.id.startsWith('sim_')) {
        const res = await fetch(`${API_BASE_URL}/api/v1/expert/tickets/${ticket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: resolvedStatus,
            expert_remediation: remediationText,
            requires_expert: false
          }),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      }
      showToast('Resolution published successfully. Ticket resolved.');
      setTimeout(() => router.push('/'), 1000);
    } catch (err: any) {
      showToast(err.message || 'Failed to publish advisory.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHoldOnSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setIsSaving(true);
    try {
      if (!ticket.id.startsWith('sim_')) {
        const res = await fetch(`${API_BASE_URL}/api/v1/expert/tickets/${ticket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'IN_PROGRESS',
            on_hold: true,
            assigned_to: holdExpertName,
            assigned_phone: holdExpertPhone
          }),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      }
      setTicket(prev => prev ? { ...prev, on_hold: true, assigned_to: holdExpertName, assigned_phone: holdExpertPhone } : null);
      setShowHoldPrompt(false);
      showToast('Ticket placed on hold. Outbound farmer alerts dispatched.');
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch on-site task.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  function getSteps(t: Ticket): string[] {
    const steps = t.remediation_steps || t.actionable_steps || [];
    if (Array.isArray(steps)) return steps;
    return String(steps).split('. ').filter(Boolean);
  }

  function getTranscript(t: Ticket): string {
    return t.voice_transcript || t.problem_transcript || '—';
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-55/50 text-slate-800 flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col justify-center items-center py-32 space-y-4">
          <RefreshCw className="h-10 w-10 text-slate-700 animate-spin" />
          <p className="text-slate-500 text-sm font-semibold">Loading ticket profile for review...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-55/50 text-slate-800 flex flex-col">
        <Navbar />
        <div className="max-w-md mx-auto py-24 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-600">Ticket Profile Not Found</h3>
          <button onClick={() => router.push('/')} className="bg-white border border-slate-300 hover:border-slate-400 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer shadow-sm">
            Return to Queue
          </button>
        </div>
      </div>
    );
  }

  const isEnglishLang = selectedLang.code.startsWith('en');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-grow">

        {/* Navigation / Header */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-5">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 bg-white hover:border-slate-350 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Portal
          </button>

          <div className="flex items-center gap-3">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700 shadow-sm">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">RSK Expert Review</h2>
              <p className="text-[10px] text-slate-450 font-mono mt-0.5">Reference ID: {ticket.id}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {ticket.on_hold && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-amber-50 text-amber-700 border-amber-250">
                ON SITE VISIT DISPATCHED
              </span>
            )}
            <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border ${
              ticket.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
              ticket.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-250' :
              'bg-rose-50 text-rose-700 border-rose-250'
            }`}>{ticket.status}</span>
          </div>
        </div>

        {/* Dynamic Review Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT: Farmer Evidence & Context */}
          <div className="lg:col-span-7 space-y-6">

            {/* Farmer contact card */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">Farmer Contact Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 block">Farmer Name</span>
                  <strong className="text-slate-800 font-bold flex items-center gap-1.5 text-sm">
                    <User className="h-4 w-4 text-slate-500" /> {ticket.farmer_name || 'Anonymous'}
                  </strong>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block">Village / Area</span>
                  <strong className="text-slate-800 font-bold flex items-center gap-1.5 text-sm">
                    <MapPin className="h-4 w-4 text-slate-500" /> {ticket.village_name || 'Nellore'}
                  </strong>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block">Contact Number</span>
                  <strong className="text-slate-850 font-bold flex items-center gap-1.5 text-sm font-mono">
                    <Phone className="h-4 w-4 text-slate-500" /> {ticket.phone_number || '+918902734851'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Farmer Voice Transcript */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">Voice Transcript / Report</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 italic text-slate-700 text-sm leading-relaxed">
                "{getTranscript(ticket)}"
              </div>
            </div>

            {/* Image attachments */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">Submitted Image Attachments</h3>
              {ticket.images && ticket.images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {ticket.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveLightboxImg(imgUrl)}
                      className="group relative h-36 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-350 transition duration-200 shadow-xs"
                    >
                      <img src={imgUrl} alt={`Attachment Leaf ${idx + 1}`} className="object-cover h-full w-full group-hover:scale-102 transition duration-305" />
                      <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <span className="text-[10px] font-bold text-slate-800 bg-white/90 px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                          View Attachment
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 bg-slate-50/50 border border-dashed border-slate-250 rounded-xl text-center text-xs text-slate-450 space-y-1">
                  <ImageIcon className="h-5 w-5 mx-auto text-slate-400" />
                  <p>No leaf images submitted with this ticket.</p>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: AI Diagnostic Engine & Expert Resolution Form */}
          <div className="lg:col-span-5 space-y-6">

            {/* AI Diagnostics details */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">AI Ingestion Diagnosis</h3>

              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider block mb-1">Crop Classification</span>
                  <span className="text-sm font-black text-slate-800 block">{ticket.crop_type || 'Unknown'}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider block mb-1">AI Classification</span>
                    <span className="text-sm font-black text-slate-800 block">{ticket.disease_name || 'Healthy'}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider block mb-1">Severity & Confidence</span>
                    <span className={`text-sm font-black block ${
                      ticket.severity_level === 'HIGH' ? 'text-rose-600' :
                      ticket.severity_level === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {ticket.severity_level} ({ticket.confidence !== undefined ? `${Math.round(ticket.confidence * 100)}%` : '—'})
                    </span>
                  </div>
                </div>

                {getSteps(ticket).length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">AI Suggested Action Steps</span>
                    <ul className="space-y-1.5">
                      {getSteps(ticket).map((step, i) => (
                        <li key={i} className="flex gap-2 text-slate-600 leading-relaxed text-[11px]">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* ── Voice Analysis Result ────────────────────────────────── */}
            {voiceAnalysis && (
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 p-5 rounded-2xl shadow-sm space-y-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 p-1.5 rounded-lg border border-indigo-200">
                    <Languages className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Voice Analysis Result</span>
                </div>

                {/* Original transcript */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">
                    Original ({voiceAnalysis.langLabel})
                  </span>
                  <div className="bg-white/70 border border-indigo-100 rounded-xl p-3 text-xs text-slate-700 italic leading-relaxed">
                    "{voiceAnalysis.originalText}"
                  </div>
                </div>

                {/* English translation */}
                {!isEnglishLang && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                      <Globe className="h-3 w-3" /> English Translation
                    </span>
                    <div className="bg-white/70 border border-indigo-100 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
                      {voiceAnalysis.englishText}
                    </div>
                  </div>
                )}

                {/* Gemini AI Response — English */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Gemini AI Response (English)
                  </span>
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
                    {voiceAnalysis.aiResponseEn}
                  </div>
                </div>

                {/* Gemini AI Response — Local Language */}
                {!isEnglishLang && voiceAnalysis.aiResponseLocal !== voiceAnalysis.aiResponseEn && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1">
                      <Languages className="h-3 w-3" /> AI Response ({voiceAnalysis.langLabel})
                    </span>
                    <div className="bg-violet-50/80 border border-violet-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
                      {voiceAnalysis.aiResponseLocal}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expert Resolution advisory form */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">Expert advisory</h3>
                <button
                  type="button"
                  onClick={handleAutofill}
                  disabled={isAutofilling}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-700 hover:border-slate-350 border border-slate-200 bg-white px-2 py-1 rounded-lg transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isAutofilling
                    ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating…</>
                    : <><Sparkles className="h-3 w-3 text-slate-500" /> AI Autofill</>
                  }
                </button>
              </div>

              {/* ── Language selector + Mic button ── */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                {/* Language dropdown */}
                <div className="relative flex-1" ref={langDropRef}>
                  <button
                    type="button"
                    onClick={() => setIsLangOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 transition cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span>{selectedLang.flag}</span>
                      <span className="truncate">{selectedLang.label}</span>
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isLangOpen && (
                    <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => { setSelectedLang(lang); setIsLangOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition cursor-pointer ${
                            lang.code === selectedLang.code ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mic button */}
                <button
                  type="button"
                  id="voice-mic-btn"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessingVoice}
                  title={isRecording ? 'Stop recording' : `Record in ${selectedLang.label}`}
                  className={`shrink-0 relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-xs ${
                    isRecording
                      ? 'bg-rose-500 text-white border border-rose-400 animate-pulse'
                      : isProcessingVoice
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  {isProcessingVoice ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing…</>
                  ) : isRecording ? (
                    <><MicOff className="h-3.5 w-3.5" /> Stop</>
                  ) : (
                    <><Mic className="h-3.5 w-3.5" /> Voice</>
                  )}
                </button>
              </div>

              {isRecording && (
                <div className="flex items-center gap-2 text-xs text-rose-600 font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  Listening in {selectedLang.label}… speak now
                </div>
              )}

              <textarea
                rows={5}
                placeholder="Publish agronomic field instructions for the farmer... or use the voice mic above."
                value={remediationText}
                onChange={e => setRemediationText(e.target.value)}
                className="w-full bg-white border border-slate-350 focus:border-slate-550 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none transition resize-none leading-relaxed"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Hold for On-Site Button */}
                <button
                  onClick={() => setShowHoldPrompt(true)}
                  disabled={isSaving || ticket.on_hold}
                  className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs tracking-wider uppercase shadow-xs"
                >
                  <MapPinned className="h-4 w-4" />
                  {ticket.on_hold ? 'On-Site Visited' : 'Hold for On-Site'}
                </button>

                {/* Resolve Ticket Button */}
                <button
                  onClick={handlePublishAdvisory}
                  disabled={isSaving}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs tracking-wider uppercase shadow-sm"
                >
                  {isSaving ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="h-4 w-4" /> Resolve Ticket</>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* IMAGE ATTACHMENT LIGHTBOX */}
      {activeLightboxImg && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <button
            onClick={() => setActiveLightboxImg(null)}
            className="absolute top-6 right-6 p-2 bg-white border border-slate-200 text-slate-700 rounded-xl cursor-pointer transition shadow-lg"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
            <img src={activeLightboxImg} alt="Attachment Zoomed View" className="object-contain max-h-[85vh] max-w-full" />
          </div>
        </div>
      )}

      {/* HOLD FOR ON-SITE TASK DISPATCH PROMPT MODAL */}
      {showHoldPrompt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-250 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-fade-in text-slate-800">
            <button
              onClick={() => setShowHoldPrompt(false)}
              className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-650 bg-white border border-slate-200 rounded-xl transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="bg-amber-50 p-2 rounded-xl border border-amber-200 text-amber-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-850 font-sans">On-Site Visit Assignment</h3>
                <p className="text-[10px] text-slate-450 font-medium">Dispatch details for field expert</p>
              </div>
            </div>

            <form onSubmit={handleHoldOnSiteSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Expert Name (On-Site Duty)</label>
                <input
                  type="text"
                  value={holdExpertName}
                  onChange={e => setHoldExpertName(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none transition font-sans text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Expert Contact Number</label>
                <input
                  type="text"
                  value={holdExpertPhone}
                  onChange={e => setHoldExpertPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none transition font-mono text-xs"
                  required
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-600 space-y-1.5 scale-95 origin-left">
                <span className="text-[9px] text-slate-450 font-bold uppercase block">Generated Villager Alert</span>
                <p className="italic font-sans text-[11px] leading-relaxed">
                  "Dear {ticket.farmer_name || 'Farmer'}, an RSK expert visit has been scheduled for your farm in the next 24 hours. Please contact RSK expert {holdExpertName} at {holdExpertPhone} to fix the exact time and location."
                </p>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 tracking-wider text-xs uppercase shadow-sm"
              >
                {isSaving ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Assigning...</>
                ) : (
                  <><Check className="h-4 w-4" /> Dispatch On-Site duty</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 font-extrabold px-6 py-4 rounded-2xl shadow-xl flex items-center gap-2 border text-sm ${
          toastMessage.type === 'error'
            ? 'bg-rose-500 text-white border-rose-455 shadow-rose-500/10'
            : 'bg-emerald-500 text-slate-950 border-emerald-450 shadow-emerald-500/10'
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
