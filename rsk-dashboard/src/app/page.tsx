'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, Timestamp, addDoc } from 'firebase/firestore';
import Navbar from './components/Navbar';
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
  Check, 
  AlertCircle, 
  X,
  Sparkles
} from 'lucide-react';

interface Ticket {
  id: string;
  farmer_name: string;
  crop_type: string;
  disease_name: string;
  confidence: number;
  severity_level: 'LOW' | 'MEDIUM' | 'HIGH';
  voice_transcript: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  created_at: any;
  remediation_steps?: string[];
  expert_notes?: string;
  resolved_at?: any;
}

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Establish Firestore real-time listener (onSnapshot)
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, orderBy('created_at', 'desc'));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const ticketList: Ticket[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          ticketList.push({
            id: docSnapshot.id,
            ...data
          } as Ticket);
        });
        setTickets(ticketList);
        setIsFirestoreConnected(true);
      }, (error) => {
        console.error("Firestore onSnapshot error: ", error);
        setIsFirestoreConnected(false);
        setUsingMockFallback(true);
        // Load mock offline tickets
        setTickets(getMockTickets());
      });
    } catch (err) {
      console.error("Firebase connection initialization failed: ", err);
      setIsFirestoreConnected(false);
      setUsingMockFallback(true);
      setTickets(getMockTickets());
    }

    return () => unsubscribe();
  }, []);

  // Mock Tickets generator for offline mode
  const getMockTickets = (): Ticket[] => [
    {
      id: "mock_1",
      farmer_name: "Ramesh Kurva",
      crop_type: "Tomato",
      disease_name: "Late Blight",
      confidence: 0.94,
      severity_level: "HIGH",
      voice_transcript: "My tomato plants are showing dark brown spots on lower leaves since the rain last week.",
      status: "PENDING",
      created_at: new Date(),
      remediation_steps: ["Apply Copper Oxychloride 3g/L", "Prune lower infected leaves", "Avoid overhead irrigation"]
    },
    {
      id: "mock_2",
      farmer_name: "Srinivas Rao",
      crop_type: "Rice",
      disease_name: "Rice Blast",
      confidence: 0.88,
      severity_level: "MEDIUM",
      voice_transcript: "Rice crops in Guntur fields have spindle lesions. Need immediate control measures.",
      status: "IN_PROGRESS",
      created_at: new Date(Date.now() - 3600000 * 4),
      remediation_steps: ["Spray Tricyclazole 75 WP at 0.6g/L", "Reduce nitrogen fertilizer dosage"]
    }
  ];

  // 2. Mock ticket generator trigger
  const handleGenerateMockTicket = async () => {
    const mockNames = ["Venkatesh Prasad", "Bala Krishna", "Chandra Babu", "Subba Reddy", "Murali Mohan"];
    const mockCrops = ["Tomato", "Rice", "Cotton", "Maize", "Chilli"];
    const mockDiseases = [
      { name: "Late Blight", severity: "HIGH", steps: ["Spraying copper fungicides", "Maintain plant canopy ventilation"] },
      { name: "Rice Blast", severity: "HIGH", steps: ["Tricyclazole application", "Proper field drying"] },
      { name: "Leaf Blight", severity: "MEDIUM", steps: ["Mancozeb 0.2% spray", "Seed treatment"] },
      { name: "Fusarium Wilt", severity: "HIGH", steps: ["Soil drenching", "Crop rotation"] },
      { name: "Healthy Plant", severity: "LOW", steps: ["Optimal soil conditions", "Normal watering schedule"] }
    ];

    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomCrop = mockCrops[Math.floor(Math.random() * mockCrops.length)];
    const randomDisease = mockDiseases[Math.floor(Math.random() * mockDiseases.length)];

    const payload = {
      farmer_name: randomName,
      crop_type: randomCrop,
      disease_name: randomDisease.name,
      confidence: parseFloat((0.75 + Math.random() * 0.2).toFixed(2)),
      severity_level: randomDisease.severity as any,
      voice_transcript: `Simulated voice message: Found symptoms of ${randomDisease.name} on my ${randomCrop} crops.`,
      status: "PENDING",
      created_at: Timestamp.now(),
      remediation_steps: randomDisease.steps
    };

    if (isFirestoreConnected && !usingMockFallback) {
      try {
        await addDoc(collection(db, 'tickets'), payload);
        showToast("Generated a new live farmer ticket in Firestore!");
      } catch (err) {
        console.error("Firestore mock add failed: ", err);
        showToast("Failed to write live ticket. Appending locally.");
        setTickets(prev => [{ id: "temp_" + Math.random(), ...payload } as Ticket, ...prev]);
      }
    } else {
      setTickets(prev => [{ id: "temp_" + Math.random(), ...payload } as Ticket, ...prev]);
      showToast("Offline fallback active: Appended ticket to local array.");
    }
  };

  // 3. Update expert resolution and submit back to Firestore
  const handleResolveTicket = async () => {
    if (!selectedTicket) return;

    const updatePayload = {
      status: newStatus,
      expert_notes: remediationText,
      resolved_at: Timestamp.now()
    };

    if (isFirestoreConnected && !usingMockFallback) {
      try {
        const ticketDocRef = doc(db, 'tickets', selectedTicket.id);
        await updateDoc(ticketDocRef, updatePayload);
        showToast(`Ticket status updated to ${newStatus}!`);
      } catch (err) {
        console.error("Firestore update failed: ", err);
        showToast("Failed to save resolution. Updated locally.");
      }
    }

    // Always update local state immediately
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...updatePayload } : t));
    setSelectedTicket(prev => prev ? { ...prev, ...updatePayload } : null);
    setRemediationText('');
  };

  // 4. Statistics computations
  const stats = {
    total: tickets.length,
    pending: tickets.filter(t => t.status === 'PENDING').length,
    highSeverity: tickets.filter(t => t.severity_level === 'HIGH' && t.status !== 'RESOLVED').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length
  };

  // 5. Filter tickets based on selection tabs and search inputs
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.farmer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.crop_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.disease_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterTab === 'PENDING') return matchesSearch && t.status === 'PENDING';
    if (filterTab === 'HIGH_SEVERITY') return matchesSearch && t.severity_level === 'HIGH' && t.status !== 'RESOLVED';
    if (filterTab === 'RESOLVED') return matchesSearch && t.status === 'RESOLVED';
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-grow">
        
        {/* Quick Simulator Tool Row */}
        <div className="flex justify-end gap-2 text-xs">
          <button
            onClick={handleGenerateMockTicket}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition duration-200 shadow-lg shadow-emerald-500/20 active:scale-95 border border-emerald-400 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Simulate Farmer Alert
          </button>
        </div>

        {/* Statistics Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium">Total Alerts Received</p>
            <p className="text-3xl font-extrabold mt-2 text-slate-100">{stats.total}</p>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium">Pending Expert Action</p>
            <p className="text-3xl font-extrabold mt-2 text-slate-100">{stats.pending}</p>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium">High Severity Blights</p>
            <p className="text-3xl font-extrabold mt-2 text-rose-400">{stats.highSeverity}</p>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
            <p className="text-slate-400 text-sm font-medium">Resolved Advisory</p>
            <p className="text-3xl font-extrabold mt-2 text-emerald-400">{stats.resolved}</p>
          </div>
        </section>

        {/* Filter bar */}
        <section className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/20 border border-slate-800/60 p-4 rounded-2xl backdrop-blur-sm">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 overflow-x-auto w-full md:w-auto">
            {(['ALL', 'PENDING', 'HIGH_SEVERITY', 'RESOLVED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer ${
                  filterTab === tab
                    ? 'bg-slate-900 text-emerald-400 shadow-md border border-slate-800'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search farmer, crop or disease..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
            />
          </div>
        </section>

        {/* Alert Queue */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List Queue */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Active Ticket Queue</h3>
            
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setRemediationText(ticket.expert_notes || '');
                    setNewStatus(ticket.status);
                  }}
                  className={`bg-slate-900/40 border p-5 rounded-2xl cursor-pointer transition relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${
                    selectedTicket?.id === ticket.id
                      ? 'border-emerald-500 bg-slate-900/80'
                      : 'border-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        ticket.severity_level === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        ticket.severity_level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {ticket.severity_level} SEVERITY
                      </span>
                      <span className="text-slate-400 text-xs font-semibold">{ticket.crop_type}</span>
                    </div>

                    <h4 className="text-base font-extrabold text-slate-200 group-hover:text-slate-100 transition">
                      {ticket.disease_name} <span className="text-xs text-slate-500 font-normal">({Math.round(ticket.confidence * 100)}% AI confidence)</span>
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {ticket.farmer_name}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> 
                        {ticket.created_at?.toDate ? ticket.created_at.toDate().toLocaleDateString() : new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border shrink-0 ${
                    ticket.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    ticket.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-24 bg-slate-900/10 border border-slate-800/40 rounded-3xl backdrop-blur-sm">
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-slate-700 mx-auto mb-4 border border-slate-800/40">
                  <Sprout className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-400">No tickets found</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                  No active tickets match the selected filtering rules or search phrase. Click "Simulate Farmer Alert" to create one!
                </p>
              </div>
            )}
          </div>

          {/* Expert Resolution Drawer Sidebar */}
          <div className="lg:col-span-1">
            {selectedTicket ? (
              <div className="bg-slate-900/40 border border-emerald-500/20 p-6 rounded-2xl backdrop-blur-md space-y-6 sticky top-24">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-200">Expert Action Console</h3>
                    <p className="text-xs text-slate-500">Remediate advisory for ticket ID: {selectedTicket.id.substring(0, 8)}...</p>
                  </div>
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="p-1 text-slate-500 hover:text-slate-300 transition hover:bg-slate-800/40 rounded-lg cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Farmer Audio Transcript</span>
                    <p className="text-slate-300 leading-relaxed italic">"{selectedTicket.voice_transcript}"</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">AI Generated Remediation</span>
                    <ul className="space-y-1.5 pt-1">
                      {selectedTicket.remediation_steps && selectedTicket.remediation_steps.map((step, idx) => (
                        <li key={idx} className="flex gap-2 text-slate-300 leading-relaxed">
                          <span className="text-emerald-400 font-bold">•</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Resolution Input */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Expert Advisory Notes</label>
                    <textarea
                      rows={4}
                      placeholder="Add specific instructions for the farmer..."
                      value={remediationText}
                      onChange={(e) => setRemediationText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none transition duration-150 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remediation Status</label>
                      <select
                        value={newStatus}
                        onChange={(e: any) => setNewStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={handleResolveTicket}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="h-4 w-4" /> Save Advisory
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-slate-900/10 border border-slate-800/40 rounded-3xl backdrop-blur-sm h-full flex flex-col justify-center items-center">
                <Clock className="h-10 w-10 text-slate-700 mx-auto stroke-1" />
                <h3 className="text-sm font-bold text-slate-400 mt-3">Select a ticket</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                  Click on any farmer alert ticket on the left to review remediation actions.
                </p>
              </div>
            )}
          </div>

        </section>
      </main>

      {/* Floating Global Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-extrabold px-6 py-4 rounded-2xl shadow-xl shadow-emerald-500/10 flex items-center gap-2 border border-emerald-400 animate-slide-up text-sm">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
