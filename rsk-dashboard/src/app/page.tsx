'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Navbar from './components/Navbar';
import {
  Sprout, AlertTriangle, CheckCircle, Clock, Search,
  User, Calendar, Send, Check, X, Sparkles, RefreshCw
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface Ticket {
  id: string;
  farmer_name?: string;
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
}

export default function RSKDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [remediationText, setRemediationText] = useState('');
  const [newStatus, setNewStatus] = useState<string>('RESOLVED');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'HIGH_SEVERITY' | 'RESOLVED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── Fetch all tickets from backend API ──────────────────────────────────────
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

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // ── Generate simulated ticket ────────────────────────────────────────────────
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
      crop_type: crops[Math.floor(Math.random() * crops.length)],
      disease_name: d.name,
      confidence: parseFloat((0.75 + Math.random() * 0.2).toFixed(2)),
      severity_level: d.severity as any,
      voice_transcript: `Simulated report: Found symptoms of ${d.name}.`,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      remediation_steps: d.steps,
    };

    setTickets(prev => [mockTicket, ...prev]);
    showToast('Simulated farmer alert added to queue.');
  };

  // ── Save expert resolution via PATCH API ─────────────────────────────────────
  const handleResolveTicket = async () => {
    if (!selectedTicket) return;
    setIsSaving(true);
    try {
      // Only call API for real (non-simulated) tickets
      if (!selectedTicket.id.startsWith('sim_')) {
        const res = await fetch(`${API_BASE_URL}/api/v1/expert/tickets/${selectedTicket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            expert_remediation: remediationText,
          }),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      }

      // Update local state immediately
      const updated = { ...selectedTicket, status: newStatus, expert_remediation: remediationText, expert_notes: remediationText };
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
      setSelectedTicket(updated);
      showToast(`Ticket status updated to ${newStatus}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save resolution.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = {
    total: tickets.length,
    pending: tickets.filter(t => (t.status || 'PENDING') === 'PENDING').length,
    highSeverity: tickets.filter(t => t.severity_level === 'HIGH' && (t.status || 'PENDING') !== 'RESOLVED').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length,
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filteredTickets = tickets.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (t.farmer_name || '').toLowerCase().includes(q) ||
      (t.crop_type || '').toLowerCase().includes(q) ||
      (t.disease_name || '').toLowerCase().includes(q);
    const s = t.status || 'PENDING';
    if (filterTab === 'PENDING') return matchSearch && s === 'PENDING';
    if (filterTab === 'HIGH_SEVERITY') return matchSearch && t.severity_level === 'HIGH' && s !== 'RESOLVED';
    if (filterTab === 'RESOLVED') return matchSearch && s === 'RESOLVED';
    return matchSearch;
  });

  const getSteps = (t: Ticket): string[] => {
    const steps = t.remediation_steps || t.actionable_steps || [];
    if (Array.isArray(steps)) return steps;
    return String(steps).split('. ').filter(Boolean);
  };

  const getTranscript = (t: Ticket): string =>
    t.voice_transcript || t.problem_transcript || '—';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-grow">

        {/* Toolbar */}
        <div className="flex justify-end gap-2">
          <button onClick={fetchTickets} disabled={isLoading}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={handleGenerateMockTicket}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 border border-emerald-400 cursor-pointer active:scale-95">
            <Sparkles className="h-4 w-4" />
            Simulate Farmer Alert
          </button>
        </div>

        {/* Stats Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Alerts Received', value: stats.total, color: 'text-slate-100' },
            { label: 'Pending Expert Action', value: stats.pending, color: 'text-amber-400' },
            { label: 'High Severity Blights', value: stats.highSeverity, color: 'text-rose-400' },
            { label: 'Resolved Advisory', value: stats.resolved, color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm hover:border-slate-700 transition">
              <p className="text-slate-400 text-sm font-medium">{label}</p>
              <p className={`text-3xl font-extrabold mt-2 ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        {/* Filter Bar */}
        <section className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/20 border border-slate-800/60 p-4 rounded-2xl">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 overflow-x-auto w-full md:w-auto">
            {(['ALL', 'PENDING', 'HIGH_SEVERITY', 'RESOLVED'] as const).map((tab) => (
              <button key={tab} onClick={() => setFilterTab(tab)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer ${
                  filterTab === tab ? 'bg-slate-900 text-emerald-400 shadow-md border border-slate-800' : 'text-slate-400 hover:text-slate-300'
                }`}>
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input type="text" placeholder="Search farmer, crop or disease..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 focus:outline-none transition" />
          </div>
        </section>

        {/* Queue + Drawer */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Ticket List */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Active Ticket Queue</h3>

            {isLoading ? (
              <div className="text-center py-16 text-slate-500 text-sm">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-emerald-500/50" />
                Loading tickets from server…
              </div>
            ) : filteredTickets.length > 0 ? (
              filteredTickets.map(ticket => {
                const status = ticket.status || 'PENDING';
                const severity = ticket.severity_level || 'LOW';
                return (
                  <div key={ticket.id}
                    onClick={() => { setSelectedTicket(ticket); setRemediationText(ticket.expert_remediation || ticket.expert_notes || ''); setNewStatus(status); }}
                    className={`bg-slate-900/40 border p-5 rounded-2xl cursor-pointer transition relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${
                      selectedTicket?.id === ticket.id ? 'border-emerald-500 bg-slate-900/80' : 'border-slate-800 hover:border-slate-700'
                    }`}>
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          severity === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>{severity} SEVERITY</span>
                        <span className="text-slate-400 text-xs font-semibold">{ticket.crop_type || 'Unknown Crop'}</span>
                      </div>
                      <h4 className="text-base font-extrabold text-slate-200 truncate">
                        {ticket.disease_name || 'Unknown Disease'}{' '}
                        {ticket.confidence !== undefined && (
                          <span className="text-xs text-slate-500 font-normal">({Math.round(ticket.confidence * 100)}% AI confidence)</span>
                        )}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{ticket.farmer_name || 'Anonymous'}</span>
                        {ticket.created_at && (
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border shrink-0 ${
                      status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>{status}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-24 bg-slate-900/10 border border-slate-800/40 rounded-3xl">
                <Sprout className="h-10 w-10 text-slate-700 mx-auto mb-3 stroke-1" />
                <h3 className="text-lg font-bold text-slate-400">No tickets found</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                  Submit a diagnosis on the AI Disease Ingestion page, or simulate one above.
                </p>
              </div>
            )}
          </div>

          {/* Expert Resolution Drawer */}
          <div className="lg:col-span-1">
            {selectedTicket ? (
              <div className="bg-slate-900/40 border border-emerald-500/20 p-6 rounded-2xl backdrop-blur-md space-y-5 sticky top-24">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-200">Expert Action Console</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Ticket: {selectedTicket.id.substring(0, 14)}…</p>
                  </div>
                  <button onClick={() => setSelectedTicket(null)}
                    className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 rounded-lg transition cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Farmer Report</span>
                    <p className="text-slate-300 leading-relaxed italic">"{getTranscript(selectedTicket)}"</p>
                  </div>

                  {getSteps(selectedTicket).length > 0 && (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">AI Remediation Steps</span>
                      <ul className="space-y-1.5">
                        {getSteps(selectedTicket).map((step, i) => (
                          <li key={i} className="flex gap-2 text-slate-300 leading-relaxed">
                            <span className="text-emerald-400 font-bold shrink-0">•</span>
                            <p>{step}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">Expert Advisory Notes</label>
                    <textarea rows={4} placeholder="Add specific field instructions for the farmer…"
                      value={remediationText} onChange={e => setRemediationText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none transition resize-none leading-relaxed" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">Status</label>
                      <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer">
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button onClick={handleResolveTicket} disabled={isSaving}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50">
                        {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-slate-900/10 border border-slate-800/40 rounded-3xl h-full flex flex-col justify-center items-center">
                <Clock className="h-10 w-10 text-slate-700 mx-auto stroke-1" />
                <h3 className="text-sm font-bold text-slate-400 mt-3">Select a ticket</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">Click any alert ticket to open the expert resolution console.</p>
              </div>
            )}
          </div>

        </section>
      </main>

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
