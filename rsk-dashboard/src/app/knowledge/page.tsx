'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  FileText, Search, RefreshCw, AlertCircle, Database, Sparkles,
  Mic, MicOff, Languages, Globe, ChevronDown, ExternalLink,
  BookOpen, TrendingUp, Shield, Zap, Leaf,
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

const CATEGORY_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  disease: { label: 'Disease', color: 'bg-rose-50 text-rose-700 border border-rose-200', icon: <Shield className="h-3 w-3" /> },
  pest:    { label: 'Pest',    color: 'bg-orange-50 text-orange-700 border border-orange-200', icon: <Zap className="h-3 w-3" /> },
  scheme:  { label: 'Scheme',  color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: <TrendingUp className="h-3 w-3" /> },
  soil:    { label: 'Soil',    color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: <Leaf className="h-3 w-3" /> },
  agronomy:{ label: 'Agronomy',color: 'bg-teal-50 text-teal-700 border border-teal-200', icon: <Leaf className="h-3 w-3" /> },
  market:  { label: 'Market',  color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: <TrendingUp className="h-3 w-3" /> },
  general: { label: 'General', color: 'bg-slate-50 text-slate-600 border border-slate-200', icon: <BookOpen className="h-3 w-3" /> },
};

const QUICK_SEARCHES = [
  'West Bengal farming schemes 2024',
  'How to treat rice blast disease',
  'PM-KISAN eligibility criteria',
  'Drip irrigation subsidy rules',
  'Cotton bollworm management',
  'MSP prices for wheat and paddy',
  'Organic farming certification India',
  'Fall armyworm in maize control',
];

interface WebSource   { title: string; url: string; snippet: string; }
interface LocalPassage{ doc_id: string; title: string; text: string; category: string; similarity: number; }
interface SearchResult{
  query: string;
  answer: string;
  web_sources: WebSource[];
  local_passages: LocalPassage[];
}

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery]       = useState('');
  const [result, setResult]                 = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching]       = useState(false);
  const [searchError, setSearchError]       = useState<string | null>(null);
  const [englishQuery, setEnglishQuery]     = useState('');
  const [expandedPassages, setExpandedPassages] = useState<Record<number, boolean>>({});

  const [selectedLang, setSelectedLang]     = useState(LANGUAGES[0]);
  const [isLangOpen, setIsLangOpen]         = useState(false);
  const langDropRef                         = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording]           = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const recognitionRef                          = useRef<any>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target as Node))
        setIsLangOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Search logic ────────────────────────────────────────────────────────────
  const runSearch = async (query: string, lang: typeof LANGUAGES[0]) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setResult(null);
    setExpandedPassages({});

    const langPrefix = lang.code.split('-')[0];
    const isEnglish  = langPrefix === 'en' && !/[^\x00-\x7F]/.test(query);

    try {
      let englishSearchQuery = query;

      if (!isEnglish) {
        try {
          const tr = await fetch(`${API_BASE_URL}/api/v1/knowledge/voice-to-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: query, language_code: lang.code }),
          });
          if (tr.ok) {
            const td = await tr.json();
            englishSearchQuery = td.english_text || query;
            setEnglishQuery(englishSearchQuery);
          }
        } catch { /* fall through */ }
      } else {
        setEnglishQuery('');
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: englishSearchQuery, top_k: 6 }),
      });
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      setResult(await res.json());
    } catch (err: any) {
      setSearchError(err.message || 'Failed to search knowledge base.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(searchQuery, selectedLang);
  };

  // ── Voice ───────────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice recognition requires Chrome.'); return; }
    const r = new SR();
    r.lang = selectedLang.code;
    r.continuous = false;
    r.interimResults = false;
    r.onstart  = () => setIsRecording(true);
    r.onresult = async (e: any) => {
      const t = e.results[0][0].transcript;
      setIsRecording(false); setIsProcessingVoice(true);
      setSearchQuery(t);
      await runSearch(t, selectedLang);
      setIsProcessingVoice(false);
    };
    r.onerror = (e: any) => { setIsRecording(false); setIsProcessingVoice(false); setSearchError(`Voice error: ${e.error}`); };
    r.onend   = () => setIsRecording(false);
    recognitionRef.current = r;
    r.start();
  }, [selectedLang]);

  const stopRecording = useCallback(() => { recognitionRef.current?.stop(); setIsRecording(false); }, []);

  const hasAnswer  = result && result.answer && result.answer.length > 10;
  const hasSources = result && result.web_sources && result.web_sources.length > 0;
  const hasLocal   = result && result.local_passages && result.local_passages.length > 0;

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
            Search anything — crop diseases, government schemes, MSP prices, soil science, pest control.
            Live web results via Gemini grounding&nbsp;+&nbsp;verified local knowledge base.
            Supports voice input in local languages.
          </p>
        </div>

        {/* Language + Search bar */}
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
                      key={lang.code} type="button"
                      onClick={() => { setSelectedLang(lang); setIsLangOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition cursor-pointer ${
                        lang.code === selectedLang.code ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <span>{lang.flag}</span><span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {selectedLang.code.startsWith('en')
                ? 'English search — web + local corpus'
                : `${selectedLang.label} search — auto-translated`}
            </span>
          </div>

          {/* Search row */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              id="rag-search-input"
              placeholder={selectedLang.code.startsWith('en')
                ? 'Search anything: schemes, diseases, prices, techniques…'
                : `Type or speak in ${selectedLang.label}…`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-grow bg-white border border-slate-300 focus:border-slate-500 rounded-2xl px-5 py-3 text-sm focus:outline-none text-slate-800 transition duration-150 shadow-xs"
              required
            />
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
              {isProcessingVoice ? <RefreshCw className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="submit"
              id="rag-search-btn"
              disabled={isSearching || isRecording}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-2xl transition duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </form>

          {isRecording && (
            <p className="text-xs text-rose-600 font-semibold flex items-center gap-2 animate-pulse pl-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Listening in {selectedLang.label}… speak your query
            </p>
          )}

          {englishQuery && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-xs flex items-center gap-2 text-slate-600 font-medium">
              <Languages className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              Searching in English: <span className="italic text-slate-500">"{englishQuery}"</span>
            </div>
          )}
        </div>

        {/* Quick searches — only shown before first search */}
        {!result && !isSearching && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider pl-1">Suggested searches</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SEARCHES.map(q => (
                <button
                  key={q} type="button"
                  onClick={() => { setSearchQuery(q); runSearch(q, selectedLang); }}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs text-slate-600 font-medium transition cursor-pointer shadow-xs hover:bg-slate-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {searchError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">

          {/* ── AI Overview ── */}
          {hasAnswer && (
            <div className="bg-white border border-indigo-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50/50">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">AI Overview — Gemini Web Grounded Answer</span>
                {hasSources && (
                  <span className="ml-auto text-xs text-slate-400">{result!.web_sources.length} web source{result!.web_sources.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{result!.answer}</p>
              </div>

              {hasSources && (
                <div className="px-6 pb-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sources</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result!.web_sources.slice(0, 6).map((src, i) => (
                      <a
                        key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition group cursor-pointer"
                      >
                        <Globe className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700 truncate transition">{src.title || 'Web Source'}</p>
                          {src.url && (
                            <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              {src.url.replace(/^https?:\/\//, '').split('/')[0]}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </p>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Local corpus ── */}
          {hasLocal && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pl-1">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Local Knowledge Base</span>
                <span className="text-xs text-slate-400">— {result!.local_passages.length} matching documents</span>
              </div>

              {result!.local_passages.map((doc, idx) => {
                const meta = CATEGORY_META[doc.category] || CATEGORY_META.general;
                const isExpanded = expandedPassages[idx];
                const preview = doc.text.length > 220 ? doc.text.slice(0, 220) + '…' : doc.text;

                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                        {doc.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.color}`}>
                          {meta.icon}{meta.label}
                        </span>
                        <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded font-bold border border-slate-200">
                          {Math.round(Math.min(doc.similarity * 150, 100))}% match
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4">
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">
                        {isExpanded ? doc.text : preview}
                      </p>
                      {doc.text.length > 220 && (
                        <button
                          type="button"
                          onClick={() => setExpandedPassages(p => ({ ...p, [idx]: !p[idx] }))}
                          className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition cursor-pointer"
                        >
                          {isExpanded ? '↑ Show less' : '↓ Read more'}
                        </button>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 pb-4 text-[10px] text-slate-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-slate-400" />
                      Vector Source ID: {doc.doc_id}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {result && !hasAnswer && !hasLocal && (
            <div className="text-center py-10 text-slate-400 text-sm">
              No matching results found. Try rephrasing your query.
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
