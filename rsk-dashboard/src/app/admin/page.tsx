'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { BarChart3, RefreshCw, Sparkles, TrendingUp, AlertTriangle, CheckCircle, Clock, Wheat } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

const DISTRICTS = ['SPSR Nellore', 'Krishna', 'Guntur', 'Prakasam', 'Kurnool'];

export default function AdminPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState('SPSR Nellore');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/analytics`);
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const generateSummary = async () => {
    setIsSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/district-summary?district=${encodeURIComponent(selectedDistrict)}`, { method: 'POST' });
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('Failed to generate summary', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const maxDiseaseCount = analytics?.top_diseases?.[0]?.count || 1;
  const maxCropCount = analytics?.top_crops?.[0]?.count || 1;

  const riskColor = (level: string) => ({
    CRITICAL: 'text-rose-400', HIGH: 'text-orange-400', MODERATE: 'text-amber-400', LOW: 'text-emerald-400'
  }[level] || 'text-slate-400');

  const riskBg = (level: string) => ({
    CRITICAL: 'bg-rose-500/10 border-rose-500/20', HIGH: 'bg-orange-500/10 border-orange-500/20',
    MODERATE: 'bg-amber-500/10 border-amber-500/20', LOW: 'bg-emerald-500/10 border-emerald-500/20'
  }[level] || 'bg-slate-800 border-slate-700');

  return (
    <div className="min-h-screen bg-slate-55/50 text-slate-800 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-grow">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white border border-slate-250 p-2.5 rounded-xl text-slate-750 shadow-sm">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Admin Intelligence Dashboard</h2>
              <p className="text-xs text-slate-500 font-medium">Platform-wide analytics, disease trends & AI district summaries</p>
            </div>
          </div>
          <button onClick={fetchAnalytics} disabled={isLoading}
            className="flex items-center gap-2 bg-white hover:border-slate-350 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer shadow-sm">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-300" />
            Loading analytics…
          </div>
        ) : analytics && (
          <>
            {/* KPI Cards */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Tickets', value: analytics.total_tickets, color: 'text-slate-800', icon: BarChart3 },
                { label: 'Pending', value: analytics.status_breakdown?.PENDING || 0, color: 'text-rose-600', icon: Clock },
                { label: 'In Progress', value: analytics.status_breakdown?.IN_PROGRESS || 0, color: 'text-amber-600', icon: TrendingUp },
                { label: 'Resolved', value: analytics.status_breakdown?.RESOLVED || 0, color: 'text-emerald-600', icon: CheckCircle },
                { label: 'Outbreaks', value: analytics.total_outbreaks, color: 'text-orange-600', icon: AlertTriangle },
                { label: 'Resolution Rate', value: `${analytics.resolution_rate_pct}%`, color: 'text-violet-600', icon: Sparkles },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-slate-300 transition">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
                    <Icon className={`h-3.5 w-3.5 ${color} opacity-60`} />
                  </div>
                  <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                </div>
              ))}
            </section>

            {/* Charts Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Disease Frequency Bar Chart */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600" /> Top Detected Diseases
                </h3>
                <div className="space-y-3">
                  {(analytics.top_diseases || []).map((d: any) => (
                    <div key={d.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium truncate max-w-[200px]">{d.name}</span>
                        <span className="text-slate-400 font-bold shrink-0">{d.count} cases</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-700"
                          style={{ width: `${(d.count / maxDiseaseCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crop Distribution */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-emerald-600" /> Crop Distribution
                </h3>
                <div className="space-y-3">
                  {(analytics.top_crops || []).map((c: any) => (
                    <div key={c.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{c.name}</span>
                        <span className="text-slate-400 font-bold">{c.count} tickets</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                          style={{ width: `${(c.count / maxCropCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity Donut (CSS rings) */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-750">Severity Breakdown</h3>
                <div className="flex items-center gap-6">
                  <div className="relative w-32 h-32 shrink-0">
                    {/* Simple ring chart using conic-gradient */}
                    {(() => {
                      const { LOW = 0, MEDIUM = 0, HIGH = 0 } = analytics.severity_breakdown || {};
                      const total = LOW + MEDIUM + HIGH || 1;
                      const highPct = (HIGH / total) * 100;
                      const medPct = (MEDIUM / total) * 100;
                      const lowPct = (LOW / total) * 100;
                      return (
                        <div className="w-32 h-32 rounded-full flex items-center justify-center"
                          style={{ background: `conic-gradient(#f87171 0% ${highPct}%, #fb923c ${highPct}% ${highPct + medPct}%, #34d399 ${highPct + medPct}% 100%)` }}>
                          <div className="w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center border border-slate-200">
                            <span className="text-lg font-black text-slate-800">{total}</span>
                            <span className="text-[9px] text-slate-400 font-bold">TOTAL</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="space-y-3 text-xs">
                    {[
                      { label: 'HIGH', value: analytics.severity_breakdown?.HIGH || 0, color: 'bg-rose-500' },
                      { label: 'MEDIUM', value: analytics.severity_breakdown?.MEDIUM || 0, color: 'bg-orange-400' },
                      { label: 'LOW', value: analytics.severity_breakdown?.LOW || 0, color: 'bg-emerald-500' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center gap-2 font-medium">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                        <span className="text-slate-500">{label}</span>
                        <span className="font-extrabold text-slate-800 ml-auto">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ticket Status Breakdown */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-750">Ticket Resolution Status</h3>
                {(() => {
                  const { PENDING = 0, IN_PROGRESS = 0, RESOLVED = 0 } = analytics.status_breakdown || {};
                  const total = PENDING + IN_PROGRESS + RESOLVED || 1;
                  return (
                    <div className="space-y-4">
                      {[
                        { label: 'Resolved', value: RESOLVED, color: 'bg-emerald-500', pct: (RESOLVED / total) * 100 },
                        { label: 'In Progress', value: IN_PROGRESS, color: 'bg-amber-400', pct: (IN_PROGRESS / total) * 100 },
                        { label: 'Pending', value: PENDING, color: 'bg-rose-550', pct: (PENDING / total) * 100 },
                      ].map(({ label, value, color, pct }) => (
                        <div key={label} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-500">{label}</span>
                            <span className="font-extrabold text-slate-800">{value} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* AI District Summary */}
            <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-slate-750 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600" /> AI District Intelligence Summary
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}
                    className="bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none cursor-pointer">
                    {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <button onClick={generateSummary} disabled={isSummarizing}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 shadow-sm">
                    {isSummarizing ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating…</> : <><Sparkles className="h-3.5 w-3.5" /> Generate Summary</>}
                  </button>
                </div>
              </div>

              {summary ? (
                <div className="space-y-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black ${riskBg(summary.risk_level)}`}>
                    <span className={riskColor(summary.risk_level)}>⬤</span>
                    <span className={riskColor(summary.risk_level)}>{summary.risk_level} RISK — {summary.district}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {[
                      { label: 'Pending Tickets', value: summary.pending_tickets },
                      { label: 'High Severity', value: summary.high_severity_cases },
                      { label: 'Active Outbreaks', value: summary.active_outbreaks },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                        <p className="text-slate-400 font-bold">{label}</p>
                        <p className="text-xl font-extrabold text-slate-800 mt-1">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-55 border border-slate-200 p-5 rounded-xl">
                    <p className="text-[10px] text-violet-700 font-black uppercase tracking-wider mb-2">Gemini AI Summary</p>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{summary.ai_summary}</p>
                    <p className="text-[10px] text-slate-400 mt-3">Generated: {new Date(summary.generated_at).toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-dashed border-slate-250 rounded-xl p-8 text-center">
                  <Sparkles className="h-8 w-8 text-slate-400 mx-auto mb-3 stroke-1" />
                  <p className="text-sm text-slate-550 font-bold">No summary generated yet</p>
                  <p className="text-xs text-slate-400 mt-1">Select a district and click Generate Summary for a Gemini AI weekly intelligence report.</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
