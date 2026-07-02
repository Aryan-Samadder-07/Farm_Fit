'use client';

import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Cpu, RefreshCw, AlertCircle, TrendingUp, FileText, MapPin, LocateFixed, Edit, Check } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AgronomyPage() {
  const [soilN, setSoilN] = useState('45');
  const [soilP, setSoilP] = useState('30');
  const [soilK, setSoilK] = useState('65');
  const [soilPh, setSoilPh] = useState('6.5');
  const [soilLat, setSoilLat] = useState('14.44');
  const [soilLon, setSoilLon] = useState('79.98');
  
  const [recommendationResult, setRecommendationResult] = useState<any | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  
  const [isRecommending, setIsRecommending] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [recError, setRecError] = useState<string | null>(null);
  const [matchedMarketData, setMatchedMarketData] = useState<any | null>(null);
  const [matchedSchemesData, setMatchedSchemesData] = useState<any | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleGetLocation = () => {
    if (!navigator.geolocation) { setGeoStatus('error'); return; }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSoilLat(pos.coords.latitude.toFixed(6));
        setSoilLon(pos.coords.longitude.toFixed(6));
        setGeoStatus('success');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const fetchCropDetails = async (cropName: string) => {
    setSelectedCrop(cropName);
    setMatchedMarketData(null);
    setMatchedSchemesData(null);
    
    // 1. Fetch matched Mandi Prices
    try {
      const mRes = await fetch(`${API_BASE_URL}/api/v1/market/prices?crop_name=${encodeURIComponent(cropName)}&location_id=AP_Nellore`);
      if (mRes.ok) {
        const mData = await mRes.json();
        setMatchedMarketData(mData);
      }
    } catch (mErr) {
      console.error("Failed fetching matched market data:", mErr);
    }

    // 2. Fetch matched Government Schemes
    try {
      const sRes = await fetch(`${API_BASE_URL}/api/v1/government/schemes?crop_type=${encodeURIComponent(cropName)}&farm_size_acres=1.5&location_id=AP_Nellore`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setMatchedSchemesData(sData);
      }
    } catch (sErr) {
      console.error("Failed fetching matched schemes data:", sErr);
    }
  };

  const handleSoilRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecommending(true);
    setRecError(null);
    setRecommendationResult(null);
    setMatchedMarketData(null);
    setMatchedSchemesData(null);

    const payload = {
      N: parseFloat(soilN) || 0.0,
      P: parseFloat(soilP) || 0.0,
      K: parseFloat(soilK) || 0.0,
      pH: parseFloat(soilPh) || 7.0,
      latitude: parseFloat(soilLat) || 14.44,
      longitude: parseFloat(soilLon) || 79.98
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/agronomy/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Recommendation failed with code: ${res.status}`);
      }

      const data = await res.json();
      setRecommendationResult(data);
      setIsEditing(false);

      if (data.recommendations && data.recommendations.length > 0) {
        const topCrop = data.recommendations[0].crop_name;
        fetchCropDetails(topCrop);
      }
    } catch (err: any) {
      console.error(err);
      setRecError(err.message || "Failed to contact recommendation server.");
    } finally {
      setIsRecommending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow flex flex-col items-center justify-start">
        
        {isEditing ? (
          // Center-aligned Input Form
          <div className="w-full max-w-xl bg-slate-900/40 border border-slate-800 p-6 sm:p-8 rounded-3xl backdrop-blur-md space-y-6">
            <div className="flex items-center gap-2">
              <Cpu className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-bold">Soil Analysis Inputs</h2>
            </div>
            
            <form onSubmit={handleSoilRecommend} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Nitrogen (N)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="mg/kg"
                    value={soilN}
                    onChange={(e) => setSoilN(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Phosphorus (P)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="mg/kg"
                    value={soilP}
                    onChange={(e) => setSoilP(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Potassium (K)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="mg/kg"
                    value={soilK}
                    onChange={(e) => setSoilK(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Soil pH</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="pH value"
                    value={soilPh}
                    onChange={(e) => setSoilPh(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                    required
                  />
                </div>
              </div>

              {/* GPS Location Capture */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Farm Location (GPS)</label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={geoStatus === 'loading'}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition cursor-pointer ${
                    geoStatus === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : geoStatus === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400'
                  }`}
                >
                  {geoStatus === 'loading' ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Acquiring GPS signal...</>
                  ) : geoStatus === 'success' ? (
                    <><MapPin className="h-4 w-4" /> Location Captured ✓</>
                  ) : geoStatus === 'error' ? (
                    <><LocateFixed className="h-4 w-4" /> Location denied — retry</>
                  ) : (
                    <><LocateFixed className="h-4 w-4" /> Use My Location</>
                  )}
                </button>
                {geoStatus === 'success' && (
                  <p className="text-[11px] text-emerald-400/70 mt-1.5 text-center font-mono">
                    {parseFloat(soilLat).toFixed(5)}° N,&nbsp;{parseFloat(soilLon).toFixed(5)}° E
                  </p>
                )}
                {geoStatus !== 'success' && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Latitude</label>
                      <input type="number" step="0.0001" value={soilLat} onChange={(e) => setSoilLat(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Longitude</label>
                      <input type="number" step="0.0001" value={soilLon} onChange={(e) => setSoilLon(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none transition" />
                    </div>
                  </div>
                )}
              </div>

              {recError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{recError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isRecommending}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRecommending ? (
                  <><RefreshCw className="h-5 w-5 animate-spin" /> Evaluating soil chemistry...</>
                ) : (
                  <><Cpu className="h-5 w-5" /> Calculate Recommendations</>
                )}
              </button>
            </form>
          </div>
        ) : (
          // Center-aligned results layout with all components in a clean, vertical stack
          <div className="w-full max-w-2xl space-y-6 animate-fade-in">
            
            {/* Header: Climate Engine Context + Purple Arrow Target (Change Inputs) */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 backdrop-blur-md">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Climate Engine Context</span>
                <span className="text-xs font-bold text-slate-300 mt-1 block">
                  🌧️ Rainfall (14 days): <strong className="text-emerald-400">{recommendationResult.rainfall_calculated_mm} mm</strong>
                </span>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition border border-emerald-500/20 cursor-pointer"
              >
                <Edit className="h-3.5 w-3.5" /> Change Inputs
              </button>
            </div>

            {/* Top Recommended Crops List */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Top Recommended Crops</h3>
              
              <div className="grid grid-cols-1 gap-3">
                {recommendationResult.recommendations.map((rec: any, index: number) => {
                  const isSelected = selectedCrop.toLowerCase() === rec.crop_name.toLowerCase();
                  return (
                    <div 
                      key={index}
                      onClick={() => fetchCropDetails(rec.crop_name)}
                      className={`p-4 rounded-2xl backdrop-blur-md space-y-2 relative overflow-hidden cursor-pointer transition-all duration-200 border ${
                        isSelected 
                          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5' 
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="text-md font-bold text-slate-100">{rec.crop_name}</h4>
                          {isSelected && <span className="bg-emerald-500 text-slate-950 p-0.5 rounded-full"><Check className="h-3 w-3" /></span>}
                        </div>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                          {Math.round(rec.confidence * 100)}% Match
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-400 h-full rounded-full" 
                          style={{ width: `${Math.round(rec.confidence * 100)}%` }}
                        />
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {rec.suitability_reasons.slice(0, 2).map((reason: string, rIdx: number) => (
                          <div key={rIdx} className="flex gap-1.5 text-[11px] text-slate-400 leading-normal">
                            <span className="text-emerald-400 font-bold">•</span>
                            <p>{reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mandi Pricing Intelligence Card (Green Box Target - moved below crops list) */}
            {matchedMarketData ? (
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md space-y-4 animate-fade-in">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Mandi Pricing Intelligence ({matchedMarketData.crop_name})
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                    <span className="text-[10px] text-slate-500 block font-bold">Mandi Price (Quintal)</span>
                    <span className="text-xl font-black text-slate-100">₹{matchedMarketData.market_prices.average_price_per_quintal.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 block pt-1 border-t border-slate-900 mt-1">
                      Range: ₹{matchedMarketData.market_prices.price_range_min} - ₹{matchedMarketData.market_prices.price_range_max}
                    </span>
                  </div>
                  
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                    <span className="text-[10px] text-slate-500 block font-bold">Nearest APMC Market</span>
                    <span className="text-xs font-bold text-slate-200 block truncate">{matchedMarketData.logistics.nearest_mandi_name}</span>
                    <span className="text-[10px] text-slate-400 block pt-1 border-t border-slate-900 mt-1">
                      Distance: {matchedMarketData.logistics.distance_km} km
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-xs">
                  <span className="font-bold text-slate-400 block mb-0.5">Price Trend: <strong className="text-emerald-400 font-semibold">{matchedMarketData.market_analytics.trend}</strong></span>
                  <p className="text-slate-300 italic">"{matchedMarketData.market_analytics.optimal_selling_window_forecast}"</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-2xl text-center text-xs text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-600" />
                Fetching Mandi details for {selectedCrop}...
              </div>
            )}

            {/* Government Schemes Card (Blue Box Target - moved below Mandi card) */}
            {matchedSchemesData && matchedSchemesData.schemes && matchedSchemesData.schemes.length > 0 && (
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md space-y-3 animate-fade-in">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-emerald-400" /> Matched Government Schemes
                </h4>
                <div className="space-y-2">
                  {matchedSchemesData.schemes.map((sch: any, sIdx: number) => (
                    <div key={sIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-900 space-y-1">
                      <span className="text-xs font-bold text-emerald-400">{sch.scheme_name}</span>
                      <p className="text-[11px] text-slate-400 leading-normal">{sch.description}</p>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900 flex justify-between items-center mt-1">
                        <span>Benefit: <strong className="text-slate-300">{sch.benefit}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
