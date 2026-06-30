'use client';

import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { FileText, Search, RefreshCw, AlertCircle, Database, Sparkles } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/knowledge/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          top_k: 3
        })
      });

      if (!res.ok) {
        throw new Error(`RAG search failed: ${res.status}`);
      }

      const data = await res.json();
      setResults(data.relevant_passages || []);
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || "Failed to search agricultural knowledge base.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow w-full space-y-8">
        {/* Intro */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20">
            <Database className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Agricultural RAG Search Engine</h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Query the vector database containing ICAR manuals, crop disease advisories, and state government schemes.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="E.g., How to cure tomato late blight? Or AP irrigation subsidy rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow bg-slate-900/50 border border-slate-800 focus:border-emerald-500 rounded-2xl px-5 py-3 text-sm focus:outline-none text-slate-100 transition duration-150"
            required
          />
          <button
            type="submit"
            disabled={isSearching}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-2xl transition duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSearching ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </button>
        </form>

        {searchError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">
          {results.length > 0 ? (
            results.map((doc, idx) => (
              <div key={idx} className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md space-y-3 relative overflow-hidden animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> {doc.title}
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold border border-slate-700">
                    Similarity: {Math.round(doc.similarity * 100)}%
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  {doc.text}
                </p>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-2 border-t border-slate-900">
                  <Sparkles className="h-3 w-3 text-emerald-400" /> Vector Matching Source Document Reference ID: {doc.doc_id}
                </div>
              </div>
            ))
          ) : (
            !isSearching && searchQuery && (
              <div className="text-center py-10 text-slate-500 text-sm">
                No matching reference documents found in vector space.
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
