'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';
import { useAuth } from './context/AuthContext';
import {
  Sprout, AlertTriangle, CheckCircle, Clock, Search,
  User, Calendar, RefreshCw, Sparkles, MapPin, Phone
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
  const { user } = useAuth();
  
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
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Navigate to detailed review page
  const handleSelectTicket = (ticket: Ticket) => {
    router.push(`/review/${ticket.id}`);
  };

  // Generate simulated ticket
  const handleGenerateMockTicket = async () => {
    const names = ['Ramesh Kurva', 'Srinivas Rao', 'Chandra Babu', 'Subba Reddy', 'Murali Mohan'];
    const crops = ['Tomato', 'Rice', 'Cotton', 'Maize', 'Chilli'];
    const diseases = [
      { name: 'Late Blight', severity: 'HIGH', steps: ['Spraying copper fungicides', 'Maintain plant canopy ventilation'] },
      { name: 'Rice Blast', severity: 'HIGH', steps: ['Tricyclazole application', 'Proper field drying'] },
      { name: 'Leaf Blight', severity: 'MEDIUM', steps: ['Mancozeb 0.2% spray', 'Seed treatment'] },
      { name: 'Healthy Plant', severity: 'LOW', steps: ['Optimal soil conditions', 'Normal watering schedule'] },
    ];
    const d = diseases[Math.floor(Math.random() * diseases.length)];

    const mockTicket: Ticket = {
      id: `sim_${Date.now()}`,
      farmer_name: names[Math.floor(Math.random() * names.length)],
      phone_number: '+919876543210',
      village_name: 'Podalakur Mandal',
      crop_type: crops[Math.floor(Math.random() * crops.length)],
      disease_name: d.name,
      confidence: parseFloat((0.75 + Math.random() * 0.2).toFixed(2)),
      severity_level: d.severity as any,
      voice_transcript: `Simulated report: Found symptoms of ${d.name}.`,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      remediation_steps: d.steps,
      images: ['/media__1782798295887.png']
    };

    setTickets(prev => [mockTicket, ...prev]);
    showToast('Simulated farmer alert added to queue.');
  };

  // Stats calculation (Excluding resolved tickets from active queue counts where necessary)
  const stats = {
    total: tickets.filter(t => t.status !== 'RESOLVED').length,
    pending: tickets.filter(t => (t.status || 'PENDING') === 'PENDING').length,
    highSeverity: tickets.filter(t => t.severity_level === 'HIGH' && t.status !== 'RESOLVED').length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
  };

  // Filtered ticket queue list
  const filteredTickets = tickets.filter(t => {
    // 1. Resolved tickets should NOT show up in the RSK Portal at all
    if (t.status === 'RESOLVED') return false;

    // 2. Perform search match query
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (t.farmer_name || '').toLowerCase().includes(q) ||
      (t.crop_type || '').toLowerCase().includes(q) ||
      (t.disease_name || '').toLowerCase().includes(q);

    if (!matchSearch) return false;

    const s = t.status || 'PENDING';
    const isAssignedToMe = user ? t.assigned_to === user.name : false;

    // 3. Tab filter rules
    if (filterTab === 'PENDING') {
      return s === 'PENDING';
    }
    // In-Progress and On-Hold only show if assigned to you
    if (filterTab === 'IN_PROGRESS') {
      return s === 'IN_PROGRESS' && isAssignedToMe && !t.on_hold;
    }
    if (filterTab === 'ON_HOLD') {
      return s === 'IN_PROGRESS' && isAssignedToMe && t.on_hold === true;
    }
    if (filterTab === 'HIGH_SEVERITY') {
      return t.severity_level === 'HIGH';
    }

    return true; // 'ALL' tab shows all active non-resolved tickets
  });

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
