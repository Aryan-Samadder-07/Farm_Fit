'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft, Sprout, Calendar, User, Phone, MapPin, Sparkles, Check, RefreshCw,
  AlertTriangle, CheckCircle, Image as ImageIcon, MapPinned, Users, X
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReviewPage({ params }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Unwrap dynamic params
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

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

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
        
        // Auto-assign and transition to IN_PROGRESS if status is PENDING
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

  // Set default hold details when prompt opens
  useEffect(() => {
    if (showHoldPrompt && user) {
      setHoldExpertName(user.name || '');
      setHoldExpertPhone(user.phone_number || '+918902734851');
    }
  }, [showHoldPrompt, user]);

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

  // Publish resolution and close ticket (Archive / Mark RESOLVED)
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

  // Hold for On-site dispatch
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col justify-center items-center py-32 space-y-4">
          <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin" />
          <p className="text-slate-400 text-sm font-semibold">Loading ticket profile for review...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar />
        <div className="max-w-md mx-auto py-24 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-350">Ticket Profile Not Found</h3>
          <button onClick={() => router.push('/')} className="bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 transition cursor-pointer">
            Return to Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-grow">
        
        {/* Navigation / Header */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-900 pb-5">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Portal
          </button>
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-200">RSK Expert Review</h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Reference ID: {ticket.id}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {ticket.on_hold && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/20">
                ON SITE VISIT DISPATCHED
              </span>
            )}
            <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border ${
              ticket.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              ticket.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>{ticket.status}</span>
          </div>
        </div>

        {/* Dynamic Review Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Farmer Evidence & Context */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Farmer contact card */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Farmer Contact Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-900 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 block">Farmer Name</span>
                  <strong className="text-slate-200 font-bold flex items-center gap-1.5 text-sm">
                    <User className="h-4 w-4 text-emerald-400" /> {ticket.farmer_name || 'Anonymous'}
                  </strong>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block">Village / Area</span>
                  <strong className="text-slate-200 font-bold flex items-center gap-1.5 text-sm">
                    <MapPin className="h-4 w-4 text-emerald-400" /> {ticket.village_name || 'Nellore'}
                  </strong>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block">Contact Number</span>
                  <strong className="text-slate-200 font-bold flex items-center gap-1.5 text-sm font-mono">
                    <Phone className="h-4 w-4 text-emerald-400" /> {ticket.phone_number || '+918902734851'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Farmer Voice Transcript */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Voice Transcript / Report</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 italic text-slate-300 text-sm leading-relaxed">
                "{getTranscript(ticket)}"
              </div>
            </div>

            {/* Image attachments (Click to zoom, no download) */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Submitted Image Attachments</h3>
              {ticket.images && ticket.images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {ticket.images.map((imgUrl, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setActiveLightboxImg(imgUrl)}
                      className="group relative h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-900 cursor-pointer hover:border-emerald-500/50 transition duration-200"
                    >
                      <img src={imgUrl} alt={`Attachment Leaf ${idx + 1}`} className="object-cover h-full w-full group-hover:scale-105 transition duration-300" />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <span className="text-[10px] font-bold text-white bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">
                          View Attachment
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500 space-y-1">
                  <ImageIcon className="h-5 w-5 mx-auto text-slate-650" />
                  <p>No leaf images submitted with this ticket.</p>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: AI Diagnostic Engine & Expert Resolution Form */}
          <div className="lg:col-span-5 space-y-6">

            {/* AI Diagnostics details (Premium display) */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Ingestion Diagnosis</h3>
              
              <div className="space-y-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Crop Classification</span>
                  <span className="text-sm font-black text-slate-100 block">{ticket.crop_type || 'Unknown'}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">AI Classification</span>
                    <span className="text-sm font-black text-slate-100 block">{ticket.disease_name || 'Healthy'}</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Severity & Confidence</span>
                    <span className={`text-sm font-black block ${
                      ticket.severity_level === 'HIGH' ? 'text-rose-400' :
                      ticket.severity_level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {ticket.severity_level} ({ticket.confidence !== undefined ? `${Math.round(ticket.confidence * 100)}%` : '—'})
                    </span>
                  </div>
                </div>

                {getSteps(ticket).length > 0 && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">AI Suggested Action Steps</span>
                    <ul className="space-y-1.5">
                      {getSteps(ticket).map((step, i) => (
                        <li key={i} className="flex gap-2 text-slate-350 leading-relaxed">
                          <span className="text-emerald-400 font-bold shrink-0">•</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Expert Resolution advisory form */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expert advisory</h3>
                <button
                  type="button"
                  onClick={handleAutofill}
                  disabled={isAutofilling}
                  className="flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-violet-300 border border-violet-500/20 bg-violet-500/10 px-2 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {isAutofilling
                    ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating…</>
                    : <><Sparkles className="h-3 w-3" /> AI Autofill</>
                  }
                </button>
              </div>

              <textarea 
                rows={5} 
                placeholder="Publish agronomic field instructions for the farmer..."
                value={remediationText} 
                onChange={e => setRemediationText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none transition resize-none leading-relaxed" 
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Hold for On-Site Button */}
                <button 
                  onClick={() => setShowHoldPrompt(true)}
                  disabled={isSaving || ticket.on_hold}
                  className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs tracking-wider uppercase"
                >
                  <MapPinned className="h-4 w-4" />
                  {ticket.on_hold ? 'On-Site Visited' : 'Hold for On-Site'}
                </button>

                {/* Resolve Ticket Button */}
                <button 
                  onClick={handlePublishAdvisory} 
                  disabled={isSaving}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs tracking-wider uppercase"
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

      {/* ── IMAGE ATTACHMENT LIGHTBOX ────────────────────────────────────────── */}
      {activeLightboxImg && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <button 
            onClick={() => setActiveLightboxImg(null)}
            className="absolute top-6 right-6 p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100 rounded-xl cursor-pointer transition"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-850 shadow-2xl">
            <img src={activeLightboxImg} alt="Attachment Zoomed View" className="object-contain max-h-[85vh] max-w-full" />
          </div>
        </div>
      )}

      {/* ── HOLD FOR ON-SITE TASK DISPATCH PROMPT MODAL ───────────────────────── */}
      {showHoldPrompt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-fade-in">
            <button 
              onClick={() => setShowHoldPrompt(false)}
              className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-4">
              <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-amber-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-200 font-sans">On-Site Visit Assignment</h3>
                <p className="text-[10px] text-slate-500">Dispatch details for field expert</p>
              </div>
            </div>

            <form onSubmit={handleHoldOnSiteSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-550 font-bold uppercase tracking-wider">Expert Name (On-Site Duty)</label>
                <input 
                  type="text" 
                  value={holdExpertName} 
                  onChange={e => setHoldExpertName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none transition font-sans text-xs"
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-550 font-bold uppercase tracking-wider">Expert Contact Number</label>
                <input 
                  type="text" 
                  value={holdExpertPhone} 
                  onChange={e => setHoldExpertPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none transition font-mono text-xs"
                  required 
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-slate-400 space-y-1.5 scale-95 origin-left">
                <span className="text-[9px] text-slate-550 font-bold uppercase block">Generated Villager Alert</span>
                <p className="italic font-sans text-[11px] leading-relaxed">
                  "Dear {ticket.farmer_name || 'Farmer'}, an RSK expert visit has been scheduled for your farm in the next 24 hours. Please contact RSK expert {holdExpertName} at {holdExpertPhone} to fix the exact time and location."
                </p>
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 tracking-wider text-xs uppercase"
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
            ? 'bg-rose-500 text-white border-rose-400 shadow-rose-500/10'
            : 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/10'
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
