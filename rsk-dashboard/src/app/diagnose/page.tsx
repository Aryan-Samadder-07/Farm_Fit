'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Cpu, Image as ImageIcon, Send, AlertCircle, RefreshCw, CheckCircle, MapPin, LocateFixed, Trash2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DiagnosePage() {
  const { user } = useAuth();
  
  const [farmerName, setFarmerName] = useState('');
  const [cropType, setCropType] = useState('');
  const [problemTranscript, setProblemTranscript] = useState('');
  
  // Multiple image upload state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  const [diagnosisResult, setDiagnosisResult] = useState<any | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLon, setGeoLon] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Auto-fill from Auth Context
  useEffect(() => {
    if (user) {
      setFarmerName(user.name || '');
    }
  }, [user]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(parseFloat(pos.coords.latitude.toFixed(6)));
        setGeoLon(parseFloat(pos.coords.longitude.toFixed(6)));
        setGeoStatus('success');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const updatedFiles = [...selectedImages, ...files].slice(0, 3); // Max 3 images
      setSelectedImages(updatedFiles);

      const previews: string[] = [];
      let loaded = 0;
      if (updatedFiles.length === 0) {
        setImagePreviews([]);
        return;
      }
      
      updatedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          previews.push(reader.result as string);
          loaded++;
          if (loaded === updatedFiles.length) {
            setImagePreviews(previews);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updatedFiles = selectedImages.filter((_, idx) => idx !== indexToRemove);
    setSelectedImages(updatedFiles);

    const previews: string[] = [];
    let loaded = 0;
    if (updatedFiles.length === 0) {
      setImagePreviews([]);
      return;
    }

    updatedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        loaded++;
        if (loaded === updatedFiles.length) {
          setImagePreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFarmerDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedImages.length === 0) {
      setDiagError("Please upload at least one leaf image to diagnose.");
      return;
    }

    setIsDiagnosing(true);
    setDiagError(null);
    setDiagnosisResult(null);

    const formData = new FormData();
    formData.append("farmer_name", farmerName || "Anonymous Farmer");
    formData.append("crop_type", cropType || "Unknown");
    formData.append("problem_transcript", problemTranscript);
    
    // Auto-attach logged-in farmer coordinates if available
    if (user?.phone_number) formData.append("phone_number", user.phone_number);
    if (user?.village_name) formData.append("village_name", user.village_name);
    
    // Append multiple files to "images" parameter key
    selectedImages.forEach((imgFile) => {
      formData.append("images", imgFile);
    });
    
    if (geoLat !== null) formData.append("latitude", String(geoLat));
    if (geoLon !== null) formData.append("longitude", String(geoLon));

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/diagnosis/diagnose`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Diagnosis server error: ${res.status}`);
      }

      const data = await res.json();
      setDiagnosisResult({ ticket_id: data.ticket_id, ...data.diagnosis });
    } catch (err: any) {
      console.error(err);
      setDiagError(err.message || "Failed to contact diagnostic engine.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Form Column */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 sm:p-8 rounded-2xl backdrop-blur-md space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-bold">New Advisory Request</h2>
            </div>
            
            <form onSubmit={handleFarmerDiagnose} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300">Farmer Name</label>
                <input
                  type="text"
                  placeholder="E.g. Ramesh Kurva"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300">Crop Category</label>
                <input
                  type="text"
                  placeholder="E.g. Tomato, Rice, Cotton"
                  value={cropType}
                  onChange={(e) => setCropType(e.target.value)}
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300">Voice Transcript Description</label>
                <textarea
                  rows={3}
                  placeholder="E.g. Yellow leaves on lower branches..."
                  value={problemTranscript}
                  onChange={(e) => setProblemTranscript(e.target.value)}
                  className="mt-1.5 w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none transition duration-150 resize-none"
                  required
                />
              </div>

              {/* Multiple Images Selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Upload Leaf/Crop Health Images (Up to 3)</label>
                <div className="relative group border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 rounded-2xl p-6 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="py-2 space-y-2">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 mx-auto">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      <span className="text-emerald-400 font-bold">Select images</span> or drag files
                    </div>
                    <p className="text-[10px] text-slate-500">Upload multiple photos from different angles (Max 3)</p>
                  </div>
                </div>

                {/* Previews grid */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group h-24 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                        <img src={preview} alt={`Leaf preview ${index + 1}`} className="object-cover h-full w-full" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1.5 bg-rose-500/80 hover:bg-rose-600 rounded-lg text-slate-100 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GPS Location Capture */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Farm Location (GPS)</label>
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
                    <><LocateFixed className="h-4 w-4" /> Use My Current Location</>
                  )}
                </button>
                {geoStatus === 'success' && geoLat !== null && (
                  <p className="text-[11px] text-emerald-400/70 mt-1.5 text-center font-mono">
                    {geoLat.toFixed(5)}° N,&nbsp;{geoLon?.toFixed(5)}° E — will be attached to this ticket
                  </p>
                )}
              </div>

              {diagError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{diagError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isDiagnosing}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDiagnosing ? (
                  <><RefreshCw className="h-5 w-5 animate-spin" /> Analyzing crop leaf...</>
                ) : (
                  <><Send className="h-5 w-5" /> Submit to Ingestion Loop</>
                )}
              </button>
            </form>
          </div>

          {/* Results Column */}
          <div className="space-y-6">
            {diagnosisResult ? (
              <div className="bg-slate-900/40 border border-slate-800 p-6 sm:p-8 rounded-2xl backdrop-blur-md space-y-6">
                
                {/* AI Disclaimer Warning Banner (in bold) */}
                <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl text-center leading-relaxed">
                  <span className="text-amber-400 font-extrabold text-xs uppercase tracking-wider block">
                    ⚠️ This diagnosis is made by an AI and may not be correct, please wait for an RSK expert for a follow up
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                    <h2 className="text-xl font-bold">AI Diagnosis Complete</h2>
                  </div>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
                    Ticket Logged
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Classification</span>
                    <span className="text-lg font-black text-slate-100 mt-1 block">{diagnosisResult.disease_name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Confidence Score</span>
                      <span className="text-2xl font-black text-emerald-400 mt-1 block">
                        {Math.round(diagnosisResult.confidence * 100)}%
                      </span>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Severity Level</span>
                      <span className={`text-2xl font-black mt-1 block ${
                        diagnosisResult.severity_level === 'HIGH' ? 'text-rose-400' :
                        diagnosisResult.severity_level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {diagnosisResult.severity_level}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Remediation Steps</span>
                    <ul className="space-y-2 pt-1">
                      {(Array.isArray(diagnosisResult.actionable_steps)
                        ? diagnosisResult.actionable_steps
                        : String(diagnosisResult.actionable_steps).split('. ').filter(Boolean)
                      ).map((step: string, idx: number) => (
                        <li key={idx} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
                          <span className="text-emerald-400 font-bold">•</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-32 bg-slate-900/10 border border-slate-800/40 rounded-3xl backdrop-blur-sm h-full flex flex-col justify-center items-center">
                <Cpu className="h-12 w-12 text-slate-700 stroke-1 mx-auto" />
                <h3 className="text-lg font-bold text-slate-400 mt-4">Waiting for Diagnostic Inputs</h3>
                <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">
                  Provide a farmer name, crop name, problem description, and leaf photograph on the left.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
