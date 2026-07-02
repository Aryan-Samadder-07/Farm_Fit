'use client';

import React, { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import { Map, RefreshCw, AlertCircle, LocateFixed, MapPin, PlusCircle, CheckCircle, X, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CROP_OPTIONS = ['Tomato', 'Rice', 'Cotton', 'Maize', 'Chilli', 'Sugarcane', 'Groundnut', 'Wheat', 'Sorghum', 'Turmeric'];
const DISEASE_OPTIONS = ['Late Blight', 'Rice Blast', 'Cotton Bollworm', 'Leaf Blight', 'Fusarium Wilt', 'Powdery Mildew', 'Downy Mildew', 'Bacterial Wilt', 'Root Rot', 'Other'];

export default function GISMapPage() {
  const { user } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);

  const designation = user?.designation?.toUpperCase() || '';
  const canRegisterOutbreak = designation === 'VILLAGE CHIEF' || designation === 'ADMIN';

  // Map state
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [outbreakCount, setOutbreakCount] = useState(0);
  const [farmerCount, setFarmerCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');

  // Registration panel state
  const [showPanel, setShowPanel] = useState(false);
  const [regDisease, setRegDisease] = useState('Late Blight');
  const [regCrop, setRegCrop] = useState('Tomato');
  const [regFarmerCount, setRegFarmerCount] = useState('3');
  const [regDistrict, setRegDistrict] = useState('');
  const [regVillage, setRegVillage] = useState('');
  const [regReportedBy, setRegReportedBy] = useState('RSK Expert');
  const [regNotes, setRegNotes] = useState('');
  const [regLat, setRegLat] = useState<number | null>(null);
  const [regLon, setRegLon] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [regStatus, setRegStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [regMessage, setRegMessage] = useState('');

  const handleGetLocation = () => {
    if (!navigator.geolocation) { setGeoStatus('error'); return; }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRegLat(parseFloat(pos.coords.latitude.toFixed(6)));
        setRegLon(parseFloat(pos.coords.longitude.toFixed(6)));
        setGeoStatus('success');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleRegisterOutbreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regLat === null || regLon === null) {
      setRegStatus('error');
      setRegMessage('Please capture your GPS location before registering an outbreak.');
      return;
    }
    setRegStatus('submitting');
    setRegMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/outbreak/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease_name: regDisease,
          crop_type: regCrop,
          affected_farmer_count: parseInt(regFarmerCount) || 1,
          latitude: regLat,
          longitude: regLon,
          district: regDistrict || 'Unknown District',
          village: regVillage || 'Unknown Village',
          reported_by: regReportedBy || 'RSK Expert',
          notes: regNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      setRegStatus('success');
      setRegMessage(data.message);
      // Reload map layers to show new outbreak
      setTimeout(() => loadMap(), 1500);
    } catch (err: any) {
      setRegStatus('error');
      setRegMessage(err.message || 'Failed to register outbreak.');
    }
  };

  const resetForm = () => {
    setRegStatus('idle');
    setRegMessage('');
    setRegDisease('Late Blight');
    setRegCrop('Tomato');
    setRegFarmerCount('3');
    setRegDistrict('');
    setRegVillage('');
    setRegNotes('');
    setRegLat(null);
    setRegLon(null);
    setGeoStatus('idle');
  };

  const loadMap = async () => {
    setIsLoading(true);
    setMapError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/maps`);
      if (!res.ok) throw new Error(`GIS API responded with status: ${res.status}`);
      const layers = await res.json();

      const farmerFeatures = layers.farmer_locations?.features || [];
      const outbreakFeatures = layers.outbreak_clusters?.features || [];
      const center = layers.center || { lat: 14.44, lon: 79.98 };

      setFarmerCount(farmerFeatures.length);
      setOutbreakCount(outbreakFeatures.length);
      setLastUpdated(new Date().toLocaleTimeString());

      if (!mapRef.current) return;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const leafletLoaded = await new Promise<boolean>((resolve) => {
        if ((window as any).L) { resolve(true); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });

      if (!leafletLoaded) throw new Error('Failed to load Leaflet library.');

      const L = (window as any).L;

      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }

      const map = L.map(mapRef.current, {
        center: [center.lat, center.lon],
        zoom: 11,
        zoomControl: true,
        attributionControl: false
      });
      leafletMap.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 18
      }).addTo(map);

      // Farmer markers
      farmerFeatures.forEach((feature: any) => {
        const { properties, geometry } = feature;
        const [lng, lat] = geometry.coordinates;
        const severityColor = properties.severity_level === 'HIGH' ? '#f87171' :
                              properties.severity_level === 'MEDIUM' ? '#fb923c' : '#34d399';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${severityColor};border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 8px ${severityColor}88;"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });
        L.marker([lat, lng], { icon }).addTo(map).bindPopup(`
          <div style="background:#0f172a;color:#f1f5f9;padding:10px 12px;border-radius:10px;font-size:12px;min-width:180px;border:1px solid #1e293b;">
            <p style="color:#34d399;font-weight:bold;margin:0 0 6px;">${properties.farmer_name}</p>
            <p style="margin:0 0 2px;">Crop: <strong>${properties.crop_type}</strong></p>
            <p style="margin:0 0 2px;">Disease: <strong>${properties.disease_name}</strong></p>
            <p style="margin:0 0 2px;color:${severityColor};">Severity: ${properties.severity_level}</p>
            <p style="margin:0;opacity:0.6">AI Confidence: ${Math.round(properties.confidence * 100)}%</p>
          </div>`, { className: 'leaflet-custom-popup' });
      });

      // Outbreak cluster markers
      outbreakFeatures.forEach((feature: any) => {
        const { properties, geometry } = feature;
        const [lng, lat] = geometry.coordinates;
        L.circle([lat, lng], { radius: 5000, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.06, weight: 1.5, dashArray: '5, 5' }).addTo(map);
        const outbreakIcon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:#ef4444;opacity:0.25;animation:ping 2s infinite;"></div>
            <div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:2.5px solid white;box-shadow:0 0 12px #ef444488;z-index:1;"></div>
          </div>`,
          iconSize: [28, 28], iconAnchor: [14, 14]
        });
        L.marker([lat, lng], { icon: outbreakIcon }).addTo(map).bindPopup(`
          <div style="background:#0f172a;color:#f1f5f9;padding:10px 12px;border-radius:10px;font-size:12px;min-width:200px;border:1px solid #ef444466;">
            <p style="color:#f87171;font-weight:800;margin:0 0 6px;">⚠️ OUTBREAK ALERT</p>
            <p style="margin:0 0 2px;">Disease: <strong>${properties.disease_name}</strong></p>
            <p style="margin:0 0 2px;">Village: <strong>${properties.village}</strong></p>
            <p style="margin:0 0 2px;">District: ${properties.district}</p>
            <p style="margin:0 0 2px;color:#f87171;">Affected Farmers: <strong>${properties.affected_farmer_count}</strong></p>
            <p style="margin:0;opacity:0.6;">Avg. AI Confidence: ${Math.round(properties.average_confidence * 100)}%</p>
          </div>`, { className: 'leaflet-custom-popup' });
      });

    } catch (err: any) {
      setMapError(err.message || 'Failed to load GIS map layers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMap();
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-grow flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 gap-6">

        {/* Header Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Map className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">GIS Disease Intelligence Map</h2>
              <p className="text-xs text-slate-400">Live geospatial visualization • farmer alerts • disease outbreak clusters</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-4 bg-slate-900/40 border border-slate-800 px-4 py-2.5 rounded-xl text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <span className="text-slate-300">{farmerCount} Farmers</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                <span className="text-slate-300">{outbreakCount} Outbreaks</span>
              </span>
              {lastUpdated && <span className="text-slate-500 hidden sm:block">Updated: {lastUpdated}</span>}
            </div>

            <button onClick={loadMap} disabled={isLoading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-300 transition cursor-pointer">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {canRegisterOutbreak && (
              <button onClick={() => { setShowPanel(p => !p); resetForm(); }}
                className={`flex items-center gap-2 border px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  showPanel ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-500 hover:bg-rose-400 border-rose-500 text-white'
                }`}>
                {showPanel ? <><X className="h-4 w-4" /> Close</> : <><PlusCircle className="h-4 w-4" /> Register Outbreak</>}
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { color: 'bg-rose-400 shadow-[0_0_4px_#f87171]', label: 'High Severity' },
            { color: 'bg-orange-400 shadow-[0_0_4px_#fb923c]', label: 'Medium Severity' },
            { color: 'bg-emerald-400 shadow-[0_0_4px_#34d399]', label: 'Low / Healthy' },
            { color: 'bg-rose-500/50 border border-rose-400 border-dashed', label: '5 km Outbreak Radius' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className={`w-3 h-3 rounded-full shrink-0 ${color}`} />
              <span className="text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        {mapError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{mapError} — Please ensure the API is online and try refreshing.</span>
          </div>
        )}

        {/* Map + Registration Panel Grid */}
        <div className={`grid gap-6 flex-grow ${showPanel ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>

          {/* Map */}
          <div className={`relative min-h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 ${showPanel ? 'lg:col-span-2' : ''}`}>
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-900/90 backdrop-blur-sm">
                <RefreshCw className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
                <p className="text-sm font-bold text-slate-300">Loading GIS layers...</p>
                <p className="text-xs text-slate-500 mt-1">Fetching spatial data from API</p>
              </div>
            )}
            <div ref={mapRef} className="w-full h-full min-h-[520px]" />
          </div>

          {/* Outbreak Registration Panel */}
          {showPanel && canRegisterOutbreak && (
            <div className="lg:col-span-1">
              <div className="bg-slate-900/50 border border-rose-500/20 rounded-2xl p-5 backdrop-blur-md h-full overflow-y-auto">
                
                {regStatus === 'success' ? (
                  <div className="flex flex-col items-center justify-center text-center h-full py-12 gap-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="h-7 w-7 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-black text-slate-100">Outbreak Registered</h3>
                    <p className="text-sm text-slate-400 max-w-[220px] leading-relaxed">{regMessage}</p>
                    <p className="text-xs text-slate-500">Map is refreshing with the new cluster…</p>
                    <button onClick={() => { resetForm(); setShowPanel(false); }}
                      className="mt-2 text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer">
                      Close Panel
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Panel Header */}
                    <div className="flex items-center gap-2 mb-5">
                      <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 text-rose-400">
                        <PlusCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-100">Register Outbreak</h3>
                        <p className="text-[11px] text-slate-500">Confirm a field-verified disease cluster</p>
                      </div>
                    </div>

                    <form onSubmit={handleRegisterOutbreak} className="space-y-4">

                      {/* Disease & Crop */}
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Disease / Pest</label>
                          <select value={regDisease} onChange={e => setRegDisease(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition cursor-pointer">
                            {DISEASE_OPTIONS.map(d => <option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Affected Crop</label>
                          <select value={regCrop} onChange={e => setRegCrop(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition cursor-pointer">
                            {CROP_OPTIONS.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Farmers Affected</label>
                          <input type="number" min="1" value={regFarmerCount} onChange={e => setRegFarmerCount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition" required />
                        </div>
                      </div>

                      {/* Location fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">District</label>
                          <input type="text" placeholder="e.g. SPSR Nellore" value={regDistrict} onChange={e => setRegDistrict(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Village / Mandal</label>
                          <input type="text" placeholder="e.g. Kovur Mandal" value={regVillage} onChange={e => setRegVillage(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition" />
                        </div>
                      </div>

                      {/* GPS Capture */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Outbreak GPS Coordinates <span className="text-rose-400">*</span>
                        </label>
                        <button type="button" onClick={handleGetLocation} disabled={geoStatus === 'loading'}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition cursor-pointer ${
                            geoStatus === 'success'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : geoStatus === 'error'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-rose-500/40 hover:text-rose-400'
                          }`}>
                          {geoStatus === 'loading' ? <><RefreshCw className="h-4 w-4 animate-spin" /> Acquiring signal...</>
                           : geoStatus === 'success' ? <><MapPin className="h-4 w-4" /> Location Pinned ✓</>
                           : geoStatus === 'error' ? <><LocateFixed className="h-4 w-4" /> Denied — retry</>
                           : <><LocateFixed className="h-4 w-4" /> Pin Current Location</>}
                        </button>
                        {geoStatus === 'success' && regLat !== null && (
                          <p className="text-[10px] text-emerald-400/70 mt-1 text-center font-mono">
                            {regLat.toFixed(5)}° N, {regLon?.toFixed(5)}° E
                          </p>
                        )}
                        {geoStatus !== 'success' && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Latitude (manual)</label>
                              <input type="number" step="0.0001" placeholder="14.4426"
                                onChange={e => setRegLat(parseFloat(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500 transition" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Longitude (manual)</label>
                              <input type="number" step="0.0001" placeholder="79.9865"
                                onChange={e => setRegLon(parseFloat(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500 transition" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reporter & Notes */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reported By</label>
                        <input type="text" placeholder="RSK Expert / Field Officer name" value={regReportedBy} onChange={e => setRegReportedBy(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Field Notes (optional)</label>
                        <textarea rows={2} placeholder="Any additional field observations..." value={regNotes} onChange={e => setRegNotes(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition resize-none" />
                      </div>

                      {/* Error message */}
                      {regStatus === 'error' && regMessage && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl flex items-start gap-2 text-xs">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{regMessage}</span>
                        </div>
                      )}

                      <button type="submit" disabled={regStatus === 'submitting'}
                        className="w-full bg-rose-500 hover:bg-rose-400 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                        {regStatus === 'submitting'
                          ? <><RefreshCw className="h-4 w-4 animate-spin" /> Registering...</>
                          : <><Send className="h-4 w-4" /> Confirm & Register Outbreak</>
                        }
                      </button>

                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .leaflet-custom-popup .leaflet-popup-content-wrapper { background: transparent; border: none; box-shadow: none; padding: 0; }
        .leaflet-custom-popup .leaflet-popup-tip { background: #0f172a; }
        .leaflet-custom-popup .leaflet-popup-content { margin: 0; }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.4; } 70% { transform: scale(2); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
      `}</style>
    </div>
  );
}
