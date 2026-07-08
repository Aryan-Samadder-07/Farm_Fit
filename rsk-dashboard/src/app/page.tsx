'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';
import { useAuth } from './context/AuthContext';
import {
  Sprout, AlertTriangle, CheckCircle, Search,
  User, Calendar, RefreshCw, Sparkles, MapPin, Phone,
  ChevronRight, ArrowRight, ShieldCheck, HeartHandshake, CloudLightning
} from 'lucide-react';
import Link from 'next/link';

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
  expert_notes?: string;
  expert_remediation?: string;
  requires_expert?: boolean;
  assigned_to?: string;
  assigned_phone?: string;
  on_hold?: boolean;
  images?: string[];
}

export default function RSKDashboard() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'ON_HOLD' | 'HIGH_SEVERITY'>('ALL');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all tickets from backend API
  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/expert/tickets/all`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
      showToast('Failed to load tickets from server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchTickets();
    }
  }, [fetchTickets, token]);

  // Navigate to detailed review page
  const handleSelectTicket = (ticket: Ticket) => {
    router.push(`/review/${ticket.id}`);
  };

  // Stats calculation
  const stats = {
    total: tickets.filter(t => t.status !== 'RESOLVED').length,
    pending: tickets.filter(t => (t.status || 'PENDING') === 'PENDING').length,
    highSeverity: tickets.filter(t => t.severity_level === 'HIGH' && t.status !== 'RESOLVED').length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
  };

  // Filtered ticket queue list
  const filteredTickets = tickets.filter(t => {
    if (t.status === 'RESOLVED') return false;

    const q = searchQuery.toLowerCase();
    const matchSearch =
      (t.farmer_name || '').toLowerCase().includes(q) ||
      (t.crop_type || '').toLowerCase().includes(q) ||
      (t.disease_name || '').toLowerCase().includes(q);

    if (!matchSearch) return false;

    const s = t.status || 'PENDING';
    const isAssignedToMe = user ? t.assigned_to === user.name : false;

    if (filterTab === 'PENDING') {
      return s === 'PENDING';
    }
    if (filterTab === 'IN_PROGRESS') {
      return s === 'IN_PROGRESS' && isAssignedToMe && !t.on_hold;
    }
    if (filterTab === 'ON_HOLD') {
      return s === 'IN_PROGRESS' && isAssignedToMe && t.on_hold === true;
    }
    if (filterTab === 'HIGH_SEVERITY') {
      return t.severity_level === 'HIGH';
    }

    return true; // 'ALL' tab
  });

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-500">Checking credentials…</p>
        </div>
      </div>
    );
  }

  // ── LANDING PAGE (UNAUTHENTICATED) ─────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
        {/* Simple Top Landing Navbar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Sprout className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-lg font-black text-slate-900 tracking-tight">Farm Fit</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2 transition">
                Log In
              </Link>
              <Link href="/signup" className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl transition shadow-xs">
                Get Started
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bg-gradient-to-b from-white to-slate-50 py-20 px-6">
          <div className="max-w-7xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> Bridging the Agricultural Last Mile
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
              Connecting Agronomists to India’s Farming Communities
            </h1>
            
            <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-medium">
              We empower smallholder farmers with immediate advisory and diagnostic support, minimizing risk, preventing crop failures, and boosting food security.
            </p>
            
            <div className="pt-4">
              <Link href="/login?role=farmer" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-7 py-3.5 rounded-2xl transition shadow-md hover:scale-[1.02]">
                Access Rythu Seva Portal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Presentation Slide Segment - "Who It Serves" */}
        <section className="bg-white py-16 border-t border-b border-slate-100 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              
              {/* Left Column: Core Narrative */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-1 bg-emerald-500 rounded-full" />
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Who It Serves</h2>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-snug">
                  Empowering India's Smallholders
                </h3>
                
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  Designed primarily for India's 120 million small and marginal farmers who face critical information gaps and rely on basic mobile technologies, a smart all-in-one AI Integrated system to solve all of their problems.
                </p>
                
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  By connecting with the Farm Fit networks, we connect field agronomists directly with isolated farmers, providing rapid diagnostic and advisory support to the absolute last mile.
                </p>

                <div className="pt-2 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700">Crop Health Protection</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <HeartHandshake className="h-4.5 w-4.5 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Direct Farm Fit Linkage</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Reference presentation image */}
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-lg group">
                <img 
                  src="/landingimage1.jpg" 
                  alt="Indian Smallholder Farmer holding smartphone in field"
                  className="w-full h-auto object-cover max-h-[420px] group-hover:scale-102 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>

            </div>
          </div>
        </section>

        {/* Secondary Story Section */}
        <section className="bg-slate-50/50 py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              
              {/* Left Column: Image 2 */}
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-lg group order-last md:order-first">
                <img 
                  src="/landingimage2.jpg" 
                  alt="Rural farming community and agronomic intervention"
                  className="w-full h-auto object-cover max-h-[420px] group-hover:scale-102 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>

              {/* Right Column: Explanation */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-1 bg-indigo-500 rounded-full" />
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">How It Helps</h2>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-snug">
                  Providing Rapid Diagnostics and Local Advisories
                </h3>
                
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  We turn isolated data points into collective farming defense networks. By enabling real-time outbreak mapping and targeted notifications, Farm Fit mitigates pest spreads before they escalate.
                </p>

                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  Farmers receive expert-verified crop prescriptions in their local languages, bypassing literacy barriers with intuitive speech-to-text systems.
                </p>

                <div className="pt-2">
                  <Link href="/signup" className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-700 transition">
                    Learn more about our mission <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-slate-900 text-white py-16 px-6 text-center space-y-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-3xl font-black tracking-tight">Ready to safeguard agricultural yields?</h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              Log in to access agricultural maps, report crop anomalies, query commodity mandis, or review pending alerts.
            </p>
            <div className="pt-4 flex items-center justify-center gap-3">
              <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition text-xs">
                Register as Expert/Farmer
              </Link>
              <Link href="/login" className="bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold px-6 py-3 rounded-xl transition text-xs">
                Enter Portal
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-950 text-slate-500 py-8 px-6 text-center text-[10px] font-bold uppercase tracking-wider border-t border-slate-900">
          © {new Date().getFullYear()} Farm Fit Agricultural Intelligence Platform. All rights reserved.
        </footer>
      </div>
    );
  }

  // ── RSK EXPERT PORTAL (AUTHENTICATED) ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-grow">

        {/* Toolbar */}
        <div className="flex justify-end gap-2">
          <button onClick={fetchTickets} disabled={isLoading}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold px-4 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Alerts Received', value: stats.total, color: 'text-slate-900' },
            { label: 'Pending Expert Action', value: stats.pending, color: 'text-amber-600' },
            { label: 'High Severity Blights', value: stats.highSeverity, color: 'text-rose-600' },
            { label: 'Currently In-Progress', value: stats.inProgress, color: 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-slate-300 transition">
              <p className="text-slate-500 text-xs font-semibold">{label}</p>
              <p className={`text-3xl font-extrabold mt-2 ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        {/* Filter Bar */}
        <section className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 overflow-x-auto w-full md:w-auto">
            {(['ALL', 'PENDING', 'IN_PROGRESS', 'ON_HOLD', 'HIGH_SEVERITY'] as const).map((tab) => (
              <button key={tab} onClick={() => setFilterTab(tab)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition shrink-0 cursor-pointer ${
                  filterTab === tab
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}>
                {tab === 'IN_PROGRESS' ? 'IN PROGRESS' : tab === 'ON_HOLD' ? 'ON HOLD' : tab.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search farmer, crop or disease..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition" />
          </div>
        </section>

        {/* Ticket List Queue */}
        <section className="w-full space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Active Ticket Queue</h3>
            <span className="text-xs text-slate-400 font-medium">Showing {filteredTickets.length} active ticket(s)</span>
          </div>

          {isLoading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-300" />
              Loading active tickets...
            </div>
          ) : filteredTickets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTickets.map(ticket => {
                const status = ticket.status || 'PENDING';
                const severity = ticket.severity_level || 'LOW';
                
                const severityLBorder = 
                  severity === 'HIGH' ? 'border-l-rose-500' :
                  severity === 'MEDIUM' ? 'border-l-amber-500' :
                  'border-l-emerald-500';

                return (
                  <div key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`bg-white border border-slate-200 border-l-4 ${severityLBorder} p-6 rounded-2xl cursor-pointer hover:border-slate-400 hover:shadow-md hover:scale-[1.01] transition duration-200 relative flex flex-col justify-between gap-4 group`}
                  >
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border tracking-wide ${
                          severity === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                          severity === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}>{severity} SEVERITY</span>
                        
                        <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full border tracking-wide uppercase shrink-0 ${
                          status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-750 border-rose-250'
                        }`}>{ticket.on_hold ? 'ON HOLD' : status.replace('_', ' ')}</span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{ticket.crop_type || 'Unknown Crop'}</p>
                        <h4 className="text-base font-extrabold text-slate-800 tracking-tight leading-snug group-hover:text-slate-900 transition">
                          {ticket.disease_name || 'Unknown Disease'}
                        </h4>
                        {ticket.confidence !== undefined && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Sparkles className="h-3 w-3 text-indigo-500" />
                            <span className="text-[11px] text-slate-400 font-medium">
                              {Math.round(ticket.confidence * 100)}% AI confidence
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100 my-2 pt-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{ticket.farmer_name || 'Anonymous Farmer'}</span>
                        </div>
                        {ticket.village_name && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{ticket.village_name}</span>
                          </div>
                        )}
                        {ticket.phone_number && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{ticket.phone_number}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-2 font-medium">
                      {ticket.created_at ? (
                        <span>Submitted: {new Date(ticket.created_at).toLocaleDateString()}</span>
                      ) : (
                        <span />
                      )}
                      {ticket.on_hold && (
                        <span className="font-extrabold text-amber-600 uppercase tracking-wide bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                          Requires Site Visit
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-white border border-slate-200 border-dashed rounded-2xl">
              <Sprout className="h-10 w-10 text-slate-300 mx-auto mb-3 stroke-1" />
              <h3 className="text-base font-bold text-slate-400">No active tickets found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                No tickets match your active filters. Click Simulate Farmer Alert to ingest a new ticket.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 font-semibold px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2 border text-sm ${
          toastMessage.type === 'error'
            ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-100'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100'
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
