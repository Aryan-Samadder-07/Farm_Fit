'use client';

import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Cpu, RefreshCw, AlertCircle, TrendingUp, FileText } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AgronomyPage() {
  const [soilN, setSoilN] = useState('45');
  const [soilP, setSoilP] = useState('30');
  const [soilK, setSoilK] = useState('65');
  const [soilPh, setSoilPh] = useState('6.5');
  const [soilLat, setSoilLat] = useState('14.44');
  const [soilLon, setSoilLon] = useState('79.98');
  const [recommendationResult, setRecommendationResult] = useState<any | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [matchedMarketData, setMatchedMarketData] = useState<any | null>(null);
  const [matchedSchemesData, setMatchedSchemesData] = useState<any | null>(null);

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

      // Retrieve secondary intelligence for the top recommended crop
      if (data.recommendations && data.recommendations.length > 0) {
        const topCrop = data.recommendations[0].crop_name;
        
        // 1. Fetch matched Mandi Prices
        try {
          const mRes = await fetch(`${API_BASE_URL}/api/v1/market/prices?crop_name=${encodeURIComponent(topCrop)}&location_id=AP_Nellore`);
          if (mRes.ok) {
            const mData = await mRes.json();
            setMatchedMarketData(mData);
          }
        } catch (mErr) {
          console.error("Failed fetching matched market data:", mErr);
        }

        // 2. Fetch matched Government Schemes
        try {
          const sRes = await fetch(`${API_BASE_URL}/api/v1/government/schemes?crop_type=${encodeURIComponent(topCrop)}&farm_size_acres=1.5&location_id=AP_Nellore`);
          if (sRes.ok) {
            const sData = await sRes.json();
            setMatchedSchemesData(sData);
          }
        } catch (sErr) {
          console.error("Failed fetching matched schemes data:", sErr);
        }
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Column */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 sm:p-8 rounded-2xl backdrop-blur-md space-y-6">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={soilLat}
                    onChange={(e) => setSoilLat(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={soilLon}
                    onChange={(e) => setSoilLon(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                    required
                  />
                </div>
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
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" /> Evaluating soil chemistry...
                  </>
                ) : (
                  <>
                    <Cpu className="h-5 w-5" /> Calculate Recommendations
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Column */}
          <div className="space-y-6">
            {recommendationResult ? (
              <div className="space-y-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Historical Weather Context</span>
                    <span className="text-sm font-semibold text-slate-200 mt-1 block">
                      🌧️ Cumulative Rainfall (Last 14 days): <strong className="text-emerald-400">{recommendationResult.rainfall_calculated_mm} mm</strong>
                    </span>
                  </div>
                </div>

                <h3 className="text-md font-bold text-slate-300">Top Recommended Crops:</h3>

                {recommendationResult.recommendations.map((rec: any, index: number) => (
                  <div 
                    key={index}
                    className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-extrabold text-slate-100">{rec.crop_name}</h4>
                      <span className="text-sm font-extrabold text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                        {Math.round(rec.confidence * 100)}% Confidence
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full rounded-full" 
                        style={{ width: `${Math.round(rec.confidence * 100)}%` }}
                      />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {rec.suitability_reasons.map((reason: string, rIdx: number) => (
                        <div key={rIdx} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
                          <span className="text-emerald-400 font-bold">•</span>
                          <p>{reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Mandi Intelligence card */}
                {matchedMarketData && (
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md space-y-3">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400" /> Mandi Pricing Intelligence ({matchedMarketData.crop_name})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                        <span className="text-[10px] text-slate-500 block font-bold">Mandi Price (Quintal)</span>
                        <span className="text-lg font-black text-slate-100">₹{matchedMarketData.market_prices.average_price_per_quintal.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 block pt-1 border-t border-slate-900 mt-1">
                          Range: ₹{matchedMarketData.market_prices.price_range_min} - ₹{matchedMarketData.market_prices.price_range_max}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                        <span className="text-[10px] text-slate-500 block font-bold">Nearest APMC Market</span>
                        <span className="text-sm font-bold text-slate-200 block truncate">{matchedMarketData.logistics.nearest_mandi_name}</span>
                        <span className="text-[10px] text-slate-400 block pt-1 border-t border-slate-900 mt-1">
                          Distance: {matchedMarketData.logistics.distance_km} km
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-xs">
                      <span className="font-bold text-slate-400 block mb-0.5">Price Trend: <strong className="text-emerald-400 font-semibold">{matchedMarketData.market_analytics.trend}</strong></span>
                      <p className="text-slate-300 italic font-medium">"{matchedMarketData.market_analytics.optimal_selling_window_forecast}"</p>
                    </div>
                  </div>
                )}

                {/* Schemes Intelligence card */}
                {matchedSchemesData && matchedSchemesData.schemes && matchedSchemesData.schemes.length > 0 && (
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md space-y-3 animate-fade-in">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-emerald-400" /> Matched Government Schemes
                    </h4>
                    <div className="space-y-2">
                      {matchedSchemesData.schemes.map((sch: any, sIdx: number) => (
                        <div key={sIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-900 space-y-1">
                          <span className="text-xs font-bold text-emerald-400">{sch.scheme_name}</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{sch.description}</p>
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 flex justify-between items-center mt-1">
                            <span>Benefit: <strong className="text-slate-200">{sch.benefit}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-32 bg-slate-900/10 border border-slate-800/40 rounded-3xl backdrop-blur-sm h-full flex flex-col justify-center items-center">
                <Cpu className="h-12 w-12 text-slate-700 stroke-1 mx-auto" />
                <h3 className="text-lg font-bold text-slate-400 mt-4">Waiting for Soil Inputs</h3>
                <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">
                  Provide soil Nitrogen, Phosphorus, Potassium (N-P-K) metrics on the left to invoke the agronomic AI advice.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
