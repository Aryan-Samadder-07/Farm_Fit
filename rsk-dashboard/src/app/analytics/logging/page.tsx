'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import { Database, Sprout, TrendingUp, RefreshCw, CheckCircle, AlertCircle, Calendar, ShieldAlert } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SEASONS = ['Kharif 2024', 'Rabi 2024', 'Kharif 2025', 'Rabi 2025', 'Kharif 2026', 'Rabi 2026'];
const CROPS = ['Tomato', 'Rice', 'Cotton', 'Maize', 'Chilli', 'Sugarcane', 'Groundnut', 'Wheat', 'Sorghum', 'Turmeric'];

export default function AnalyticsLoggingPage() {
  // Form state
  const [areaName, setAreaName] = useState('');
  const [season, setSeason] = useState('Rabi 2026');
  const [crop, setCrop] = useState('Tomato');
  const [areaAcres, setAreaAcres] = useState('');
  const [yieldTonnes, setYieldTonnes] = useState('');
  const [marketPriceInr, setMarketPriceInr] = useState('');
  const [soilQualityScore, setSoilQualityScore] = useState(75);
  const [avgTemp, setAvgTemp] = useState('28.5');
  const [rainfall, setRainfall] = useState('45.0');
  const [humidity, setHumidity] = useState('65');

  // Request status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live calculations
  const totalValuation = parseFloat(yieldTonnes || '0') * parseFloat(marketPriceInr || '0');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaName || !areaAcres || !yieldTonnes || !marketPriceInr) {
      setErrorMsg("Please fill out all mandatory fields.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      area_name: areaName,
      season,
      crop,
      area_acres: parseFloat(areaAcres),
      yield_tonnes: parseFloat(yieldTonnes),
      market_price_inr: parseFloat(marketPriceInr),
      soil_quality_score: parseFloat(soilQualityScore.toString()),
      avg_temperature: parseFloat(avgTemp),
      rainfall_mm: parseFloat(rainfall),
      humidity: parseFloat(humidity)
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/farm/analytics/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save collective log.");

      setSuccessMsg("Agricultural collective data logged successfully in regional database.");
      // Reset parts of form
      setAreaAcres('');
      setYieldTonnes('');
      setMarketPriceInr('');
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during dispatch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow relative z-10">
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-8 relative z-20">
          
          {/* Header Row */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-4">
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100">Farm Analytics Logging</h1>
              <p className="text-xs text-slate-400">Publish regional harvest outputs and environmental indexes for intelligence mapping</p>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3 text-xs leading-relaxed animate-fade-in">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-xs leading-relaxed animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form and Side Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Input fields */}
            <form onSubmit={handleSubmit} className="lg:col-span-2 bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-6">
              
              {/* Regional Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mandi / Area Name <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Podalakur"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Crop Season <span className="text-rose-400">*</span></label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-3 py-3 text-sm focus:outline-none text-slate-100 cursor-pointer"
                  >
                    {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Crop & Area metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Crop Cultivated</label>
                  <select
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-3 py-3 text-sm focus:outline-none text-slate-100 cursor-pointer"
                  >
                    {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Cultivated Area (Acres) <span className="text-rose-400">*</span></label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 120.5"
                    value={areaAcres}
                    onChange={(e) => setAreaAcres(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-100"
                    required
                  />
                </div>
              </div>

              {/* Yield and Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Yield Obtained (Tonnes) <span className="text-rose-400">*</span></label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 240.2"
                    value={yieldTonnes}
                    onChange={(e) => setYieldTonnes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Avg Market Price (₹ / Tonne) <span className="text-rose-400">*</span></label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 18500"
                    value={marketPriceInr}
                    onChange={(e) => setMarketPriceInr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-100"
                    required
                  />
                </div>
              </div>

              {/* Soil index slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Soil Quality Score</label>
                  <span className="text-sm font-mono font-bold text-emerald-400">{soilQualityScore} / 100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soilQualityScore}
                  onChange={(e) => setSoilQualityScore(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Environmental Metrics */}
              <div className="grid grid-cols-3 gap-4 border-t border-slate-900 pt-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Temp (°C)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="28.5"
                    value={avgTemp}
                    onChange={(e) => setAvgTemp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Rainfall (mm)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="45.0"
                    value={rainfall}
                    onChange={(e) => setRainfall(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Humidity (%)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="65"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Publishing log...</>
                ) : (
                  <><Database className="h-4 w-4" /> Publish Collective Analytics</>
                )}
              </button>

            </form>

            {/* Live Estimations display card */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Valuation details */}
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Live Valuation Estimate</span>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Yield Volume</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-extrabold text-slate-100">{yieldTonnes || '0'}</span>
                      <span className="text-xs text-slate-400">Tons</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Estimated Gross Revenue</span>
                    <div className="text-2xl font-black text-emerald-400 mt-1">
                      ₹{totalValuation.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs text-slate-400 leading-relaxed">
                    Estimates are calculated using direct gross yield weight multiplied by current regional market values.
                  </div>
                </div>
              </div>

              {/* Instructions banner */}
              <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md flex gap-3 text-xs leading-relaxed text-slate-400">
                <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-300 mb-1">DLT Compliance Note</h4>
                  Ensure data values match MANDI weigh-in records before publishing. Incorrect submissions must be manually reconciled by the RSK administrator.
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
