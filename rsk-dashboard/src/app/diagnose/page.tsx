'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Cpu, Image as ImageIcon, Send, AlertCircle, RefreshCw, CheckCircle, MapPin, LocateFixed, Trash2, Mic, MicOff, ChevronDown, Globe, Languages } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const LANGUAGES = [
  { code: 'en-IN', label: 'English', flag: '🇬🇧' },
  { code: 'hi-IN', label: 'हिंदी (Hindi)', flag: '🇮🇳' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', flag: '🇮🇳' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' },
];

export default function DiagnosePage() {
  const { user } = useAuth();
  
  const [farmerName, setFarmerName] = useState('');
  const [cropType, setCropType] = useState('');
  const [problemTranscript, setProblemTranscript] = useState('');
  
  // Voice Recording states
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [englishTranslation, setEnglishTranslation] = useState('');
  const recognitionRef = useRef<any>(null);
  const langDropRef = useRef<HTMLDivElement>(null);

  // Close lang dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const startRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in this browser. Use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang.code;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      setProblemTranscript(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      setDiagError(`Voice error: ${event.error}`);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };
  
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
    setEnglishTranslation('');

    const formData = new FormData();
    formData.append("farmer_name", farmerName || "Anonymous Farmer");
    formData.append("crop_type", cropType || "Unknown");
    formData.append("problem_transcript", problemTranscript);
    
    // Auto-attach logged-in farmer details if available
    if (user?.phone_number) formData.append("phone_number", user.phone_number);
    if (user?.village_name) formData.append("village_name", user.village_name);
    if (user?.email) formData.append("email", user.email);
    
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
      setDiagnosisResult({ 
        ticket_id: data.ticket_id, 
        ...data.diagnosis,
        localized_diagnosis: data.localized_diagnosis,
        detected_language: data.detected_language 
      });
      setEnglishTranslation(data.english_transcript || '');
    } catch (err: any) {
      console.error(err);
      setDiagError(err.message || "Failed to contact diagnostic engine.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Form Column */}
          <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-xl shadow-xs space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-slate-850" />
              <h2 className="text-xl font-bold text-slate-900">New Advisory Request</h2>
            </div>
            
            <form onSubmit={handleFarmerDiagnose} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Farmer Name</label>
                <input
                  type="text"
                  placeholder="E.g. Ramesh Kurva"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="mt-1.5 w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none transition duration-150"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Crop Category</label>
                <input
                  type="text"
                  placeholder="E.g. Tomato, Rice, Cotton"
                  value={cropType}
                  onChange={(e) => setCropType(e.target.value)}
                  className="mt-1.5 w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none transition duration-150"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-semibold text-slate-700">Voice Transcript Description</label>
                  
                  {/* Language Selector */}
                  <div className="relative" ref={langDropRef}>
                    <button
                      type="button"
                      onClick={() => setIsLangOpen(v => !v)}
                      className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-650 transition cursor-pointer"
                    >
                      <span>{selectedLang.flag}</span>
                      <span>{selectedLang.label}</span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>
                    {isLangOpen && (
                      <div className="absolute right-0 z-30 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden w-40 max-h-48 overflow-y-auto">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => { setSelectedLang(lang); setIsLangOpen(false); }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-left hover:bg-slate-50 transition cursor-pointer ${
                              lang.code === selectedLang.code ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-650'
                            }`}
                          >
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mt-1.5">
                  <textarea
                    rows={3}
                    placeholder={selectedLang.code.startsWith('en') 
                      ? "E.g. Yellow spots on leaves expand under high moisture..." 
                      : `Speak or type in ${selectedLang.label}...`}
                    value={problemTranscript}
                    onChange={(e) => setProblemTranscript(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-lg pl-4 pr-12 py-2.5 text-sm text-slate-800 focus:outline-none transition duration-150 resize-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    title={isRecording ? 'Stop' : 'Record Voice'}
                    className={`absolute right-3.5 top-3 p-2 rounded-lg border transition cursor-pointer ${
                      isRecording 
                        ? 'bg-rose-500 text-white animate-pulse border-rose-400' 
                        : 'bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200'
                    }`}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>

                {isRecording && (
                  <p className="text-[10px] text-rose-600 font-bold animate-pulse mt-1 pl-0.5">
                    Recording in {selectedLang.label}... speak now.
                  </p>
                )}

                {englishTranslation && (
                  <div className="mt-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 text-slate-600 animate-fade-in font-medium">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] bg-slate-200 px-1.5 py-0.5 rounded shrink-0">Debug EN Translation</span>
                    <span className="italic">"{englishTranslation}"</span>
                  </div>
                )}
              </div>

              {/* Multiple Images Selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Upload Leaf/Crop Health Images (Up to 3)</label>
                <div className="relative group border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 rounded-xl p-6 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="py-2 space-y-2">
                    <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 mx-auto shadow-xs">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div className="text-xs text-slate-650 font-medium">
                      <span className="text-slate-800 font-bold">Select images</span> or drag files
                    </div>
                    <p className="text-[10px] text-slate-400">Upload multiple photos from different angles (Max 3)</p>
                  </div>
                </div>

                {/* Previews grid */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group h-24 rounded-xl overflow-hidden bg-white border border-slate-200">
                        <img src={preview} alt={`Leaf preview ${index + 1}`} className="object-cover h-full w-full" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1.5 bg-rose-500 hover:bg-rose-600 rounded-lg text-slate-100 opacity-0 group-hover:opacity-100 transition cursor-pointer"
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Farm Location (GPS)</label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={geoStatus === 'loading'}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-semibold text-sm transition cursor-pointer ${
                    geoStatus === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : geoStatus === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 shadow-xs'
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
                  <p className="text-[11px] text-emerald-600 mt-1.5 text-center font-mono">
                    {geoLat.toFixed(5)}° N,&nbsp;{geoLon?.toFixed(5)}° E — will be attached to this ticket
                  </p>
                )}
              </div>

              {diagError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                  <span>{diagError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isDiagnosing}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm shadow-xs"
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
              <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-xl shadow-xs space-y-6">
                
                {/* AI Disclaimer Warning Banner (in bold) */}
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center leading-relaxed">
                  <span className="text-amber-700 font-extrabold text-xs uppercase tracking-wider block">
                    ⚠️ This diagnosis is made by an AI and may not be correct, please wait for an RSK expert for a follow up
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                    <h2 className="text-xl font-bold text-slate-900">AI Diagnosis Complete</h2>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold">
                    Ticket Logged
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Classification</span>
                    {diagnosisResult.localized_diagnosis ? (
                      <div className="space-y-1.5 mt-1">
                        <span className="text-base font-extrabold text-slate-900 block">
                          <span className="text-emerald-700">English:</span> {diagnosisResult.disease_name}
                        </span>
                        <span className="text-sm font-bold text-indigo-700 block">
                          <span className="text-indigo-650">{LANGUAGES.find(l => l.code.startsWith(diagnosisResult.detected_language))?.label || diagnosisResult.detected_language}:</span> {diagnosisResult.localized_diagnosis.disease_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-extrabold text-slate-900 mt-1 block">{diagnosisResult.disease_name}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Confidence Score</span>
                      <span className="text-2xl font-black text-emerald-600 mt-1 block">
                        {Math.round(diagnosisResult.confidence * 100)}%
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Severity Level</span>
                      <span className={`text-2xl font-black mt-1 block ${
                        diagnosisResult.severity_level === 'HIGH' ? 'text-rose-600' :
                        diagnosisResult.severity_level === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {diagnosisResult.severity_level}
                      </span>
                    </div>
                  </div>

                  {diagnosisResult.localized_diagnosis ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* English Steps */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block bg-emerald-50 px-2 py-0.5 rounded w-max">Remediation (English)</span>
                        <ul className="space-y-2 pt-1">
                          {(Array.isArray(diagnosisResult.actionable_steps)
                            ? diagnosisResult.actionable_steps
                            : String(diagnosisResult.actionable_steps).split('. ').filter(Boolean)
                          ).map((step: string, idx: number) => (
                            <li key={idx} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
                              <span className="text-emerald-500 font-bold shrink-0">•</span>
                              <p>{step}</p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Local Steps */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block bg-indigo-50 px-2 py-0.5 rounded w-max">
                          Remediation ({LANGUAGES.find(l => l.code.startsWith(diagnosisResult.detected_language))?.label || diagnosisResult.detected_language})
                        </span>
                        <ul className="space-y-2 pt-1">
                          {(Array.isArray(diagnosisResult.localized_diagnosis.actionable_steps)
                            ? diagnosisResult.localized_diagnosis.actionable_steps
                            : String(diagnosisResult.localized_diagnosis.actionable_steps).split('. ').filter(Boolean)
                          ).map((step: string, idx: number) => (
                            <li key={idx} className="flex gap-2 text-xs text-slate-650 leading-relaxed font-semibold">
                              <span className="text-indigo-500 font-bold shrink-0">•</span>
                              <p>{step}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Remediation Steps</span>
                      <ul className="space-y-2 pt-1">
                        {(Array.isArray(diagnosisResult.actionable_steps)
                          ? diagnosisResult.actionable_steps
                          : String(diagnosisResult.actionable_steps).split('. ').filter(Boolean)
                        ).map((step: string, idx: number) => (
                          <li key={idx} className="flex gap-2 text-sm text-slate-650 leading-relaxed">
                            <span className="text-emerald-500 font-bold">•</span>
                            <p>{step}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-32 bg-white border border-slate-200 border-dashed rounded-xl shadow-xs h-full flex flex-col justify-center items-center">
                <Cpu className="h-12 w-12 text-slate-350 stroke-1 mx-auto" />
                <h3 className="text-base font-bold text-slate-400 mt-4">Waiting for Diagnostic Inputs</h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
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
