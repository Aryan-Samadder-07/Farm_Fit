'use client';

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Sprout, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search, 
  User, 
  MapPin, 
  Calendar, 
  Send, 
  CloudRain, 
  Database, 
  Sparkles, 
  RefreshCw, 
  Check, 
  AlertCircle,
  X
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Interfaces for our Ticket structure
interface Ticket {
  id: string;
  farmer_name: string;
  crop_type: string;
  problem_transcript: string;
  disease_name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  actionable_remediation: string;
  requires_expert: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  expert_remediation?: string;
  created_at?: any; // Firestore timestamp or string
  updated_at?: any;
}

// Sample mock data for fallback & preview
const INITIAL_MOCK_TICKETS: Ticket[] = [
  {
    id: "mock_1",
    farmer_name: "Ramesh Kurva",
    crop_type: "Tomato",
    problem_transcript: "The leaves are curling and showing dark black spots. It is spreading quickly through my crop.",
    disease_name: "Late Blight",
    severity: "HIGH",
    actionable_remediation: "Apply copper-based fungicides immediately. Prune affected leaves and destroy them to prevent spore spread.",
    requires_expert: true,
    status: "PENDING",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: "mock_2",
    farmer_name: "Mallesh Goud",
    crop_type: "Rice",
    problem_transcript: "Spindle-shaped spots on leaves, some lesions have grey center. I think it is rice blast disease.",
    disease_name: "Rice Blast",
    severity: "MEDIUM",
    actionable_remediation: "Avoid excessive nitrogen fertilizers. Spray Tricyclazole at recommended doses. Keep field drained.",
    requires_expert: true,
    status: "PENDING",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString() // 5 hours ago
  },
  {
    id: "mock_3",
    farmer_name: "Lakshmi Devi",
    crop_type: "Cotton",
    problem_transcript: "Some yellowing on leaf margins, minor bug holes, but generally the crop is growing fine.",
    disease_name: "Healthy / Minor Leafhopper damage",
    severity: "LOW",
    actionable_remediation: "No immediate chemical spray needed. Install yellow sticky traps and monitor pests weekly.",
    requires_expert: false,
    status: "RESOLVED",
    expert_remediation: "Reviewed. Advised farmer to maintain organic pest trap density.",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString() // 12 hours ago
  }
];

export default function RSKDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // Modal resolution states
  const [remediationText, setRemediationText] = useState('');
  const [newStatus, setNewStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'RESOLVED'>('RESOLVED');
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'HIGH_SEVERITY' | 'RESOLVED'>('ALL');
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const [usingMockFallback, setUsingMockFallback] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // 1. Establish Firestore real-time listener (onSnapshot)
  useEffect(() => {
    let unsubscribe = () => {};
    
    try {
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, orderBy('created_at', 'desc'));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Ticket[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            farmer_name: data.farmer_name || 'Unknown Farmer',
            crop_type: data.crop_type || 'Unknown Crop',
            problem_transcript: data.problem_transcript || '',
            disease_name: data.disease_name || 'Undiagnosed',
            severity: data.severity || 'LOW',
            actionable_remediation: data.actionable_remediation || '',
            requires_expert: data.requires_expert !== undefined ? data.requires_expert : true,
            status: data.status || 'PENDING',
            expert_remediation: data.expert_remediation || '',
            created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at
          });
        });
        
        setTickets(list);
        setIsFirestoreConnected(true);
        setUsingMockFallback(false);
      }, (error) => {
        console.warn("Firestore live query failed, falling back to local simulation:", error);
        setIsFirestoreConnected(false);
        setUsingMockFallback(true);
        setTickets(INITIAL_MOCK_TICKETS);
      });
    } catch (e) {
      console.warn("Firebase app initialization failed, working in mock mode:", e);
      setIsFirestoreConnected(false);
      setUsingMockFallback(true);
      setTickets(INITIAL_MOCK_TICKETS);
    }

    return () => unsubscribe();
  }, []);

  // 2. Poll Backend API (FastAPI) status to show connection health
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/`);
        if (res.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  // 3. Trigger alert notification timer helper
  const showToast = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 4000);
  };

  // 4. Handle ticket resolution submission (Integrates with PATCH endpoint!)
  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    
    setIsSubmitting(true);
    setErrorMessage(null);

    // Prepare API updates
    const payload = {
      status: newStatus,
      expert_remediation: remediationText,
      requires_expert: newStatus !== 'RESOLVED' // If resolved, remove from expert queue
    };

    try {
      if (backendStatus === 'online') {
        // Fetch to local FastAPI backend PATCH route
        const res = await fetch(`${API_BASE_URL}/api/v1/expert/tickets/${selectedTicket.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`Server returned error code: ${res.status}`);
        }
      }

      // Simultaneously sync with Firestore directly for real-time reactivity
      if (isFirestoreConnected && !usingMockFallback) {
        const docRef = doc(db, 'tickets', selectedTicket.id);
        await updateDoc(docRef, {
          status: payload.status,
          expert_remediation: payload.expert_remediation,
          requires_expert: payload.requires_expert,
          updated_at: serverTimestamp()
        });
      } else {
        // Fallback update local React state if in simulation mode
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { 
          ...t, 
          status: newStatus,
          expert_remediation: remediationText,
          requires_expert: payload.requires_expert
        } : t));
      }

      showToast(`Ticket for ${selectedTicket.farmer_name} updated to ${newStatus}.`);
      setSelectedTicket(null);
      setRemediationText('');
    } catch (err: any) {
      console.error("Resolution submit error:", err);
      setErrorMessage(err.message || "Failed to update ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Setup handler to generate a mock incoming ticket in real-time
  const handleGenerateMockTicket = async () => {
    const crops = ['Potato', 'Maize', 'Chili', 'Banana', 'Groundnut'];
    const names = ['Kalyan Kumar', 'Venkatesh Raju', 'Savitri Amma', 'Appa Rao', 'Narayana Swamy'];
    const diseases = ['Early Blight', 'Rust Infection', 'Leaf Curl Virus', 'Panama Disease', 'Stem Borer'];
    const transcripts = [
      "The stems of my plants are showing brown rotting circles, and the leaves are dying off.",
      "Orange dust-like powder is forming on the underside of crop leaves.",
      "New growth leaves are wrinkled and twisted, crop growth is totally stunted.",
      "The banana crop leaves are yellowing and split, trunk is splitting near the base.",
      "Insects are boring tunnels inside the plant stems causing the head to dry up."
    ];
    
    const idx = Math.floor(Math.random() * crops.length);
    const severities: ('LOW'|'MEDIUM'|'HIGH')[] = ['LOW', 'MEDIUM', 'HIGH'];
    const randomSeverity = severities[Math.floor(Math.random() * severities.length)];

    const newTicketObj = {
      farmer_name: names[idx],
      crop_type: crops[idx],
      problem_transcript: transcripts[idx],
      disease_name: diseases[idx],
      severity: randomSeverity,
      actionable_remediation: "Initial diagnosis system recommend immediate organic neem oil sprays and reduction in overhead crop watering.",
      requires_expert: randomSeverity === 'HIGH' || Math.random() > 0.3,
      status: 'PENDING' as const
    };

    try {
      if (isFirestoreConnected && !usingMockFallback) {
        await addDoc(collection(db, 'tickets'), {
          ...newTicketObj,
          created_at: serverTimestamp()
        });
        showToast("New alert added to live Firestore!");
      } else {
        const localMockTicket: Ticket = {
          id: `sim_${Date.now()}`,
          ...newTicketObj,
          created_at: new Date().toISOString()
        };
        setTickets(prev => [localMockTicket, ...prev]);
        showToast("New simulated farmer alert pushed!");
      }
    } catch (error) {
      console.error("Failed to add mock ticket:", error);
    }
  };

  // 6. Filter tickets based on selection tabs and search inputs
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.farmer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.crop_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.disease_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (filterTab) {
      case 'PENDING':
        return t.status === 'PENDING' && t.requires_expert;
      case 'HIGH_SEVERITY':
        return t.severity === 'HIGH';
      case 'RESOLVED':
        return t.status === 'RESOLVED';
      case 'ALL':
      default:
        return true;
    }
  });

  // Calculate statistic numbers
  const stats = {
    total: tickets.length,
    pending: tickets.filter(t => t.status === 'PENDING' && t.requires_expert).length,
    high: tickets.filter(t => t.severity === 'HIGH').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-500 text-slate-950 px-5 py-4 rounded-xl shadow-2xl font-semibold border border-emerald-400/30 animate-bounce">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Sprout className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Rythu Seva Kendras (RSK)
              </h1>
              <p className="text-xs text-slate-400 font-medium">Real-Time Expert Diagnostics Panel & Dashboard</p>
            </div>
          </div>
          
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Mock simulator trigger */}
            <button
              onClick={handleGenerateMockTicket}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition duration-200 shadow-lg shadow-emerald-500/20 active:scale-95 border border-emerald-400"
            >
              <Sparkles className="h-4 w-4" />
              Simulate Farmer Alert
            </button>

            {/* Firestore Status */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
              <Database className={`h-3.5 w-3.5 ${isFirestoreConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="text-slate-400">Firestore:</span>
              <span className={`font-semibold ${isFirestoreConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`}>
                {isFirestoreConnected ? 'Connected' : 'Offline Mode'}
              </span>
            </div>

            {/* Backend API Status */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
              <RefreshCw className={`h-3.5 w-3.5 ${backendStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'} ${backendStatus === 'connecting' ? 'animate-spin' : ''}`} />
              <span className="text-slate-400">API:</span>
              <span className={`font-semibold ${backendStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {backendStatus === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Statistics Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium">Total Alerts Received</p>
            <p className="text-3xl font-extrabold mt-2 text-slate-100">{stats.total}</p>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" /> Pending Expert Action
            </p>
            <p className="text-3xl font-extrabold mt-2 text-amber-400">{stats.pending}</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-400" /> High Severity Blights
            </p>
            <p className="text-3xl font-extrabold mt-2 text-rose-400">{stats.high}</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-emerald-400" /> Resolved Advisory
            </p>
            <p className="text-3xl font-extrabold mt-2 text-emerald-400">{stats.resolved}</p>
          </div>
        </section>

        {/* Filter Toolbar */}
        <section className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-slate-800/60 p-4 rounded-2xl backdrop-blur-sm">
          {/* Tabs */}
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`flex-1 md:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 ${filterTab === 'ALL' ? 'bg-slate-800 text-emerald-400 border border-slate-700/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setFilterTab('PENDING')}
              className={`flex-1 md:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 ${filterTab === 'PENDING' ? 'bg-slate-800 text-amber-400 border border-slate-700/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Pending Review
            </button>
            <button
              onClick={() => setFilterTab('HIGH_SEVERITY')}
              className={`flex-1 md:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 ${filterTab === 'HIGH_SEVERITY' ? 'bg-slate-800 text-rose-400 border border-slate-700/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              High Severity
            </button>
            <button
              onClick={() => setFilterTab('RESOLVED')}
              className={`flex-1 md:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition duration-150 ${filterTab === 'RESOLVED' ? 'bg-slate-800 text-emerald-400 border border-slate-700/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Resolved
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search farmer, crop or disease..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition duration-150"
            />
          </div>
        </section>

        {/* Tickets Grid */}
        <section>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/10 border border-slate-800/40 rounded-3xl backdrop-blur-sm">
              <Sprout className="h-12 w-12 text-slate-600 mx-auto stroke-1" />
              <h3 className="text-lg font-bold text-slate-400 mt-4">No tickets found</h3>
              <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
                No active tickets match the selected filtering rules or search phrase. Click "Simulate Farmer Alert" to create one!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTickets.map((ticket) => {
                // Determine severity badge styles
                const severityStyle = {
                  HIGH: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                  MEDIUM: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                  LOW: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }[ticket.severity];

                const cardBorder = {
                  HIGH: 'border-l-4 border-l-rose-500',
                  MEDIUM: 'border-l-4 border-l-amber-500',
                  LOW: 'border-l-4 border-l-emerald-500'
                }[ticket.severity];

                return (
                  <div 
                    key={ticket.id} 
                    className={`bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-md hover:border-slate-700/80 transition duration-200 group ${cardBorder} shadow-lg relative overflow-hidden`}
                  >
                    {/* Glow indicators for new PENDING expert tickets */}
                    {ticket.status === 'PENDING' && ticket.requires_expert && (
                      <div className="absolute top-0 right-0 w-3 h-3 bg-amber-500 rounded-full m-3 animate-ping" />
                    )}

                    <div className="space-y-4">
                      {/* Top Info row */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full uppercase ${severityStyle}`}>
                          {ticket.severity} SEVERITY
                        </span>
                        
                        {/* Status indicators */}
                        {ticket.status === 'RESOLVED' ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                            <CheckCircle className="h-3.5 w-3.5" /> Resolved
                          </span>
                        ) : ticket.status === 'IN_PROGRESS' ? (
                          <span className="flex items-center gap-1 text-cyan-400 text-xs font-semibold">
                            <Clock className="h-3.5 w-3.5 animate-spin" /> Reviewing
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                            <AlertCircle className="h-3.5 w-3.5" /> Pending Expert
                          </span>
                        )}
                      </div>

                      {/* Farmer & Location details */}
                      <div className="border-b border-slate-800/80 pb-3">
                        <h4 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                          <User className="h-4.5 w-4.5 text-slate-500" /> {ticket.farmer_name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>RSK Regional Hub (Tomato Crop)</span>
                        </div>
                      </div>

                      {/* Reported issue audio transcript */}
                      <div className="space-y-1">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Farmer Voice Alert:</span>
                        <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                          "{ticket.problem_transcript}"
                        </p>
                      </div>

                      {/* Gemini Diagnosis result */}
                      <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-widest flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Gemini Classification
                          </span>
                          <span className="text-xs text-emerald-300 font-bold">{ticket.crop_type}</span>
                        </div>
                        <h5 className="font-extrabold text-md text-emerald-300">
                          {ticket.disease_name}
                        </h5>
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mt-1">
                          {ticket.actionable_remediation}
                        </p>
                      </div>

                      {/* Expert notes if completed */}
                      {ticket.expert_remediation && (
                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1 text-xs">
                          <span className="font-bold text-slate-400 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-emerald-400" /> Expert Advisory Notes:
                          </span>
                          <p className="text-slate-300 italic">"{ticket.expert_remediation}"</p>
                        </div>
                      )}
                    </div>

                    {/* Bottom CTA review button */}
                    <div className="mt-6 pt-4 border-t border-slate-800/80">
                      {ticket.status !== 'RESOLVED' ? (
                        <button
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setRemediationText(ticket.expert_remediation || '');
                            setNewStatus(ticket.status === 'PENDING' ? 'IN_PROGRESS' : ticket.status);
                          }}
                          className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:text-emerald-400 font-bold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-150 text-slate-200"
                        >
                          Review & Resolve
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setRemediationText(ticket.expert_remediation || '');
                            setNewStatus('RESOLVED');
                          }}
                          className="w-full bg-slate-950 border border-slate-900 text-slate-400 hover:text-slate-200 font-bold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-150"
                        >
                          View Advisory details
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Slide-out review drawer / Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
            
            {/* Modal Header */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-5">
                <div className="flex items-center gap-2">
                  <Sprout className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-lg font-extrabold text-slate-100">Review Advisory Ticket</h3>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 p-2 rounded-xl border border-slate-700/50 transition duration-150"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Error warning inside form */}
              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mt-4 flex items-center gap-3 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Ticket Details Panel */}
              <div className="space-y-6 mt-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Farmer Information</h4>
                  <p className="text-lg font-bold text-slate-100 mt-1">{selectedTicket.farmer_name}</p>
                  <p className="text-xs text-slate-500">Location: Nellore Hub • Field Registered: Aug 2025</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audio Transcript Report</h4>
                  <p className="text-sm text-slate-200 italic mt-2">"{selectedTicket.problem_transcript}"</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Gemini Multimodal Diagnostics</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Crop Variety</span>
                      <span className="text-sm font-bold text-emerald-400">{selectedTicket.crop_type}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Gemini Diagnosis</span>
                      <span className="text-sm font-bold text-emerald-400">{selectedTicket.disease_name}</span>
                    </div>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl mt-3">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Automatic System Remediation Advice</span>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">{selectedTicket.actionable_remediation}</p>
                  </div>
                </div>

                {/* Form area */}
                <form onSubmit={handleResolveTicket} className="space-y-4 pt-4 border-t border-slate-800">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300">Update Advisory Status</label>
                    <select
                      value={newStatus}
                      onChange={(e: any) => setNewStatus(e.target.value)}
                      className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-emerald-500 focus:outline-none text-sm transition"
                    >
                      <option value="PENDING">PENDING (Keep in queue)</option>
                      <option value="IN_PROGRESS">IN_PROGRESS (Under investigation)</option>
                      <option value="RESOLVED">RESOLVED (Complete and send advisory)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300">Expert Advisory Notes</label>
                    <textarea
                      rows={4}
                      value={remediationText}
                      onChange={(e) => setRemediationText(e.target.value)}
                      required={newStatus === 'RESOLVED'}
                      placeholder="Input customized agronomic advice, pesticide brands, dosage instructions, or corrective actions to be translated into voice/SMS alerts..."
                      className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 focus:border-emerald-500 focus:outline-none text-sm placeholder-slate-600 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" /> Submitting advisory...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" /> Submit Expert Advisory
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <div className="pt-8 text-center text-xs text-slate-500 border-t border-slate-800">
              Assigned to RSK Agri-Expert Panel ID: #8099
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
