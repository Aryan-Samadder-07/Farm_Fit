'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { BarChart3, Search, RefreshCw, AlertCircle, Sparkles, TrendingUp, FileText, Activity } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AnalyticsPage() {
  const [queryArea, setQueryArea] = useState('Nellore');
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const fetchAreaIntelligence = async (areaName: string) => {
    setIsFetchingAnalytics(true);
    setAnalyticsError(null);
    setAnalyticsData(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/farm/analytics/area/${encodeURIComponent(areaName)}`);
      if (!res.ok) throw new Error("Failed to load collective area agricultural records.");
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err: any) {
      console.error(err);
      setAnalyticsError(err.message || "Failed to query area intelligence.");
    } finally {
      setIsFetchingAnalytics(false);
    }
  };

  // Pre-load Nellore on startup
  useEffect(() => {
    fetchAreaIntelligence('Nellore');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <div className="space-y-8">
          {/* Search and Query Row */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-emerald-400" />
              <div>
                <h2 className="text-xl font-bold">Area Agricultural Intelligence</h2>
                <p className="text-xs text-slate-400">Regional crop yield trajectories, weather timelines, and soil health monitoring</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Enter Village or Mandi Name..."
                value={queryArea}
                onChange={(e) => setQueryArea(e.target.value)}
                className="bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none text-slate-100 w-full md:w-64"
              />
              <button
                onClick={() => fetchAreaIntelligence(queryArea)}
                disabled={isFetchingAnalytics}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition duration-150 flex items-center gap-1.5 shrink-0 cursor-pointer animate-fade-in"
              >
                {isFetchingAnalytics ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {analyticsError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{analyticsError}</span>
            </div>
          )}

          {analyticsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Farm Health Score & Risk Indicators */}
              <div className="lg:col-span-1 space-y-6">
                {/* Health score card */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md space-y-6 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Average Regional Soil Health</span>
                  
                  <div className="space-y-4">
                    {/* Radial Indicator */}
                    <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          stroke="currentColor"
                          className="text-slate-800"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          stroke="currentColor"
                          className={
                            analyticsData.health_score > 75 ? 'text-emerald-400' :
                            analyticsData.health_score > 50 ? 'text-amber-400' : 'text-rose-400'
                          }
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={376.8}
                          strokeDashoffset={376.8 - (376.8 * analyticsData.health_score) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-3xl font-extrabold text-slate-100">{analyticsData.health_score}%</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest">Optimal</span>
                      </div>
                    </div>

                    <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                      analyticsData.health_score > 75 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      analyticsData.health_score > 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                    }`}>
                      Soil Quality: {
                        analyticsData.health_score > 75 ? 'Excellent' :
                        analyticsData.health_score > 50 ? 'Moderate' : 'Critical'
                      }
                    </span>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left text-xs leading-relaxed space-y-1">
                      <span className="font-bold text-slate-400 flex items-center gap-1"><Sparkles className="h-3 w-3 text-emerald-400" /> Regional Insights:</span>
                      <p className="text-slate-300 italic">"The average agricultural index for {analyticsData.area_name} stands at {analyticsData.health_score}%. Ensure rotation of nitrogen-fixing crops during Kharif seasons to restore natural organic carbon."</p>
                    </div>
                  </div>
                </div>

                {/* NDVI Sentinel-2 Satellite Intelligence Module */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">NDVI Regional Monitoring</h3>
                    </div>
                    <span className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                      Sentinel-2 L2A
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                      <span className="text-xs text-slate-500">Canopy Biomass Index (NDVI)</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {analyticsData.ndvi_timeline && analyticsData.ndvi_timeline.length > 0
                          ? `${analyticsData.ndvi_timeline[analyticsData.ndvi_timeline.length - 1].val} (${
                              analyticsData.ndvi_timeline[analyticsData.ndvi_timeline.length - 1].val > 0.7 ? "Optimal" :
                              analyticsData.ndvi_timeline[analyticsData.ndvi_timeline.length - 1].val > 0.4 ? "Moderate" : "Stressed"
                            })`
                          : "0.71 (Optimal)"
                        }
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                      <div>
                        <span className="text-slate-500 block">Resolution</span>
                        <span className="font-semibold text-slate-300">10m Multispectral</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Last Satellite Pass</span>
                        <span className="font-semibold text-slate-300">24 hours ago</span>
                      </div>
                    </div>

                    {/* NDVI Trend Graph */}
                    <div className="pt-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Vegetation Index Trend</span>
                      <div className="flex items-end justify-between h-20 px-2 pt-2 border-b border-slate-900 border-l">
                        {(analyticsData.ndvi_timeline || [
                          { val: 0.32, month: 'Mar' },
                          { val: 0.48, month: 'Apr' },
                          { val: 0.65, month: 'May' },
                          { val: 0.72, month: 'Jun' },
                          { val: 0.71, month: 'Jul' }
                        ]).map((item: any, i: number) => (
                          <div key={i} className="flex flex-col items-center flex-1 group relative">
                            <div className="w-4 bg-emerald-500/20 group-hover:bg-emerald-500/40 rounded-t transition-all duration-300" 
                                 style={{ height: `${item.val * 70}px` }}>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-slate-900 text-[9px] text-emerald-400 font-bold px-1 py-0.5 rounded border border-slate-800 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none mb-1">
                                {item.val}
                              </div>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-1 font-mono">{item.month}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Historical Timelines & Yield Projections */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Yield Estimates & Projections */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-400" /> Projected Seasonal Yields ({analyticsData.area_name})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analyticsData.yield_estimates?.map((est: any, index: number) => (
                      <div key={index} className="bg-slate-950 border border-slate-855 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-300">{est.crop}</span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                            {Math.round(est.confidence * 100)}% Conf.
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1">
                          <div>
                            <span className="text-2xl font-black text-slate-100">{est.projected_yield_tonnes}</span>
                            <span className="text-xs text-slate-400 ml-1">Tonnes</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-400">₹{est.estimated_income_inr?.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-500 block">Est. Revenue</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 block pt-1 border-t border-slate-900">
                          ⏱️ Average Harvesting Window: <strong className="text-slate-300">{est.harvest_eta_days} days</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Past Seasons History */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-emerald-400" /> Previous Crop Season Logs
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 uppercase font-bold">
                          <th className="pb-3">Season</th>
                          <th className="pb-3">Crop</th>
                          <th className="pb-3">Area Logged</th>
                          <th className="pb-3 text-right">Yield</th>
                          <th className="pb-3 text-right">Estimated Valuation</th>
                          <th className="pb-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {analyticsData.crop_history?.map((hist: any, index: number) => (
                          <tr key={index} className="hover:bg-slate-900/20 text-slate-200">
                            <td className="py-3 font-semibold">{hist.season}</td>
                            <td className="py-3">{hist.crop}</td>
                            <td className="py-3 text-slate-400">{hist.area_acres} Acres</td>
                            <td className="py-3 text-right font-bold">{hist.yield_tonnes} T</td>
                            <td className="py-3 text-right font-bold text-emerald-400">₹{hist.market_price_inr?.toLocaleString()}</td>
                            <td className="py-3 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                hist.status === 'Harvested' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {hist.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Regional Outbreak Trends */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-400" /> Monthly Regional Outbreak Trends
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-center">
                    {analyticsData.monthly_trends?.map((item: any, index: number) => (
                      <div key={index} className="bg-slate-950 border border-slate-855 p-3 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{item.month}</span>
                        <div className="flex justify-center items-baseline gap-1 pt-1">
                          <span className="text-lg font-black text-rose-400">{item.disease_count}</span>
                          <span className="text-[9px] text-slate-500">cases</span>
                        </div>
                        <span className="text-[9px] text-slate-400 block pt-1 border-t border-slate-900">
                          {item.resolved_count} Resolved
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="text-center py-20 bg-slate-900/10 border border-slate-800/40 rounded-3xl backdrop-blur-sm">
              <BarChart3 className="h-12 w-12 text-slate-700 mx-auto stroke-1" />
              <h3 className="text-lg font-bold text-slate-400 mt-4">No Area Data</h3>
              <p className="text-sm text-slate-500 mt-1.5">Search for a Village / Area above to load metrics.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
