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
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="E.g., How to cure tomato late blight? Or AP irrigation subsidy rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow bg-white border border-slate-300 focus:border-slate-500 rounded-2xl px-5 py-3 text-sm focus:outline-none text-slate-800 transition duration-150 shadow-xs"
            required
          />
          <button
            type="submit"
            disabled={isSearching}
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

        {searchError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">
          {results.length > 0 ? (
            results.map((doc, idx) => (
              <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-3 relative overflow-hidden animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> {doc.title}
                  </span>
                  <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded font-bold border border-slate-200">
                    Similarity: {Math.round(doc.similarity * 100)}%
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {doc.text}
                </p>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-2 border-t border-slate-100">
                  <Sparkles className="h-3 w-3 text-slate-500" /> Vector Matching Source Document Reference ID: {doc.doc_id}
                </div>
              </div>
            ))
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
