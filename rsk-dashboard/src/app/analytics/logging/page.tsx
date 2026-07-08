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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-10 flex-grow relative z-10">

        <div className="space-y-8 relative z-20">
          
          {/* Header Row */}
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-700 shadow-sm">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Farm Analytics Logging</h1>
              <p className="text-xs text-slate-555 font-medium">Publish regional harvest outputs and environmental indexes for intelligence mapping</p>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3 text-xs leading-relaxed animate-fade-in">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-xs leading-relaxed animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form and Side Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Input fields */}
            <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-6">
              
              {/* Regional Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mandi / Area Name <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Podalakur"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Crop Season <span className="text-rose-600 font-bold">*</span></label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-3 py-3 text-sm focus:outline-none text-slate-800 cursor-pointer"
                  >
                    {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Crop & Area metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Crop Cultivated</label>
                  <select
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-3 py-3 text-sm focus:outline-none text-slate-800 cursor-pointer"
                  >
                    {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total Cultivated Area (Acres) <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 120.5"
                    value={areaAcres}
                    onChange={(e) => setAreaAcres(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Yield and Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Yield Obtained (Tonnes) <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 240.2"
                    value={yieldTonnes}
                    onChange={(e) => setYieldTonnes(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Avg Market Price (₹ / Tonne) <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 18500"
                    value={marketPriceInr}
                    onChange={(e) => setMarketPriceInr(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Soil index slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Average Soil Quality Score</label>
                  <span className="text-sm font-mono font-bold text-emerald-700">{soilQualityScore} / 100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soilQualityScore}
                  onChange={(e) => setSoilQualityScore(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Environmental Metrics */}
              <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Temp (°C)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="28.5"
                    value={avgTemp}
                    onChange={(e) => setAvgTemp(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Rainfall (mm)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="45.0"
                    value={rainfall}
                    onChange={(e) => setRainfall(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Humidity (%)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="65"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-550 rounded-xl px-4 py-3 text-sm focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
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
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Live Valuation Estimate</span>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Yield Volume</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-extrabold text-slate-900">{yieldTonnes || '0'}</span>
                      <span className="text-xs text-slate-500">Tons</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Estimated Gross Revenue</span>
                    <div className="text-2xl font-black text-emerald-700 mt-1">
                      ₹{totalValuation.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed font-medium">
                    Estimates are calculated using direct gross yield weight multiplied by current regional market values.
                  </div>
                </div>
              </div>

              {/* Instructions banner */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex gap-3 text-xs leading-relaxed text-slate-650">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">DLT Compliance Note</h4>
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
