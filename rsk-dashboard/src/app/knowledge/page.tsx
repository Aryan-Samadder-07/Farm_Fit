'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  FileText, Search, RefreshCw, AlertCircle, Database, Sparkles,
  Mic, MicOff, Languages, Globe, ChevronDown, ChevronUp
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

interface RAGResult {
  doc_id: string;
  title: string;
  text: string;
  similarity: number;
  // bilingual fields (set when a local-language query was used)
  title_en?: string;
  text_en?: string;
  lang_label?: string;
}

interface SearchMeta {
  originalQuery: string;
  englishQuery: string;
  langLabel: string;
  isLocalLang: boolean;
}

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<RAGResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, 'en' | 'local'>>({});
  const [englishTranslation, setEnglishTranslation] = useState('');

  // Language selector
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langDropRef = useRef<HTMLDivElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  // ── Standard text search ──────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await runSearch(searchQuery, selectedLang);
  };

  const runSearch = async (query: string, lang: typeof LANGUAGES[0]) => {
    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    setSearchMeta(null);
    setEnglishTranslation('');
    setExpandedCards({});

    const langPrefix = lang.code.split('-')[0];
    const containsNonEnglish = /[^\x00-\x7F]/.test(query);
    const isEnglish = langPrefix === 'en' && !containsNonEnglish;
    const searchLanguageCode = isEnglish ? 'en-IN' : (containsNonEnglish && langPrefix === 'en' ? 'auto' : lang.code);

    try {
      if (isEnglish) {
        // Standard RAG query — results are English only
        const res = await fetch(`${API_BASE_URL}/api/v1/knowledge/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 3 }),
        });
        if (!res.ok) throw new Error(`RAG search failed: ${res.status}`);
        const data = await res.json();
        setResults(data.relevant_passages || []);
        setSearchMeta({
          originalQuery: query,
          englishQuery: query,
          langLabel: lang.label,
          isLocalLang: false,
        });
      } else {
        // Bilingual preprocessed search
        const fd = new FormData();
        fd.append('text', query);
        fd.append('language_code', searchLanguageCode);
        fd.append('top_k', '3');

        const res = await fetch(`${API_BASE_URL}/api/v1/knowledge/query-preprocessed`, {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error(`Preprocessed RAG search failed: ${res.status}`);
        const data = await res.json();
        setEnglishTranslation(data.english_query || '');

        // data.relevant_passages are the translated (local-language) results
        // We also fetch the English originals in parallel
        const englishRes = await fetch(`${API_BASE_URL}/api/v1/knowledge/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: data.english_query, top_k: 3 }),
        });
        const englishData = englishRes.ok ? await englishRes.json() : { relevant_passages: [] };
        const englishPassages: any[] = englishData.relevant_passages || [];

        // Merge local + English versions by index
        const merged: RAGResult[] = (data.relevant_passages || []).map((p: any, i: number) => ({
          doc_id: p.doc_id,
          title: p.title,           // local language title
          text: p.text,             // local language text
          similarity: p.similarity,
          title_en: englishPassages[i]?.title || p.title,
          text_en: englishPassages[i]?.text || p.text,
          lang_label: lang.label,
        }));

        setResults(merged);
        setSearchMeta({
          originalQuery: data.original_query || query,
          englishQuery: data.english_query || query,
          langLabel: lang.label,
          isLocalLang: true,
        });

        // Default: show local language tab
        const defaults: Record<number, 'en' | 'local'> = {};
        merged.forEach((_, i) => { defaults[i] = 'local'; });
        setExpandedCards(defaults);
      }
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'Failed to search agricultural knowledge base.');
    } finally {
      setIsSearching(false);
    }
  };

  // ── Voice search via Web Speech API ──────────────────────────────────────
  const startRecording = useCallback(() => {
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
      setIsProcessingVoice(true);
      setSearchQuery(transcript);
      await runSearch(transcript, selectedLang);
      setIsProcessingVoice(false);
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      setIsProcessingVoice(false);
      setSearchError(`Voice error: ${event.error}`);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [selectedLang]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const toggleCard = (idx: number) => {
    setExpandedCards(prev => ({
      ...prev,
      [idx]: prev[idx] === 'local' ? 'en' : 'local',
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow w-full space-y-8">

        {/* Intro */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-700 mx-auto border border-slate-200 shadow-xs">
            <Database className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Agricultural RAG Search Engine</h2>
          <p className="text-sm text-slate-500 font-medium max-w-lg mx-auto">
            Query the vector database containing ICAR manuals, crop disease advisories, and state government schemes.
            Supports voice input in local languages — results shown in both English and your selected language.
          </p>
        </div>

        {/* Language selector + Search Bar */}
        <div className="space-y-2">
          {/* Language row */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={langDropRef}>
              <button
                type="button"
                id="lang-selector-btn"
                onClick={() => setIsLangOpen(v => !v)}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-xs"
              >
                <span>{selectedLang.flag}</span>
                <span className="hidden sm:inline">{selectedLang.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
              </button>
              {isLangOpen && (
                <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-52">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => { setSelectedLang(lang); setIsLangOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition cursor-pointer ${
                        lang.code === selectedLang.code ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {selectedLang.code.startsWith('en') ? 'English search — results in English' : `${selectedLang.label} search — bilingual results`}
            </span>
          </div>

          {/* Search row */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              id="rag-search-input"
              placeholder={selectedLang.code.startsWith('en')
                ? 'E.g., How to cure tomato late blight? Or AP irrigation subsidy rules...'
                : `Type or speak in ${selectedLang.label}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow bg-white border border-slate-300 focus:border-slate-500 rounded-2xl px-5 py-3 text-sm focus:outline-none text-slate-800 transition duration-150 shadow-xs"
              required
            />

            {/* Mic button */}
            <button
              type="button"
              id="rag-voice-btn"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSearching || isProcessingVoice}
              title={isRecording ? 'Stop' : `Search by voice in ${selectedLang.label}`}
              className={`flex items-center gap-1.5 font-bold px-4 py-3 rounded-2xl transition cursor-pointer disabled:opacity-50 shadow-xs text-sm ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse border border-rose-400'
                  : isProcessingVoice
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isProcessingVoice ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            {/* Search button */}
            <button
              type="submit"
              id="rag-search-btn"
              disabled={isSearching || isRecording}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-2xl transition duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSearching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </form>

          {isRecording && (
            <p className="text-xs text-rose-600 font-semibold flex items-center gap-2 animate-pulse pl-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              Listening in {selectedLang.label}… speak your crop query
            </p>
          )}

          {/* Debug English translation box */}
          {englishTranslation && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-xs flex items-center gap-2 text-slate-600 animate-fade-in font-medium">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] bg-slate-200 px-1.5 py-0.5 rounded shrink-0">Debug EN Translation</span>
              <span className="italic">"{englishTranslation}"</span>
            </div>
          )}
        </div>

        {/* Search meta banner */}
        {searchMeta?.isLocalLang && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 text-xs space-y-1">
            <div className="flex items-center gap-2 text-indigo-700 font-bold">
              <Languages className="h-4 w-4" />
              Multilingual Search Active
            </div>
            <div className="text-indigo-600 space-y-0.5">
              <p><span className="font-semibold text-slate-700">Original ({searchMeta.langLabel}):</span> {searchMeta.originalQuery}</p>
              <p><span className="font-semibold text-emerald-700">English (Passed to Vector DB):</span> {searchMeta.englishQuery}</p>
            </div>
          </div>
        )}

        {searchError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">
          {results.length > 0 ? (
            results.map((doc, idx) => {
              const isBilingual = !!doc.text_en && doc.text_en !== doc.text;

              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
                  {/* Card header */}
                  <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-emerald-700 flex flex-wrap gap-x-2 gap-y-1 items-center">
                      <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                      {isBilingual ? (
                        <span>
                          {doc.title_en} <span className="text-slate-400 font-normal mx-1">|</span> <span className="text-indigo-650 font-semibold">{doc.title}</span>
                        </span>
                      ) : (
                        doc.title
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-50 text-slate-650 px-2 py-0.5 rounded font-bold border border-slate-200">
                        {Math.round(doc.similarity * 100)}% match
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-6 py-4 space-y-4">
                    {isBilingual ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded w-max">
                            <Globe className="h-3 w-3" /> English
                          </span>
                          <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50/60 rounded-xl p-3 border border-slate-150">
                            {doc.text_en}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded w-max">
                            <Languages className="h-3 w-3" /> {doc.lang_label}
                          </span>
                          <p className="text-sm text-slate-750 leading-relaxed font-semibold bg-indigo-50/20 rounded-xl p-3 border border-indigo-100/60">
                            {doc.text}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">
                        {doc.text}
                      </p>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="px-6 pb-4 text-[10px] text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-slate-500" /> Vector Source ID: {doc.doc_id}
                  </div>
                </div>
              );
            })
          ) : (
            !isSearching && searchQuery && (
              <div className="text-center py-10 text-slate-400 text-sm">
                No matching reference documents found in vector space.
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
