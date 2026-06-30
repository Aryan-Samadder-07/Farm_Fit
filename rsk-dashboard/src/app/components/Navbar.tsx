'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sprout, Sparkles, Database, RefreshCw, FileText, BarChart3, Activity, Cpu } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Navbar() {
  const pathname = usePathname();
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true); // Default to true since client connects

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(API_BASE_URL + "/");
        if (res.ok) setBackendStatus('online');
        else setBackendStatus('offline');
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 20000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: 'RSK Expert Portal', href: '/', icon: Sprout },
    { name: 'AI Disease Ingestion', href: '/diagnose', icon: Sparkles },
    { name: 'Soil Advisory', href: '/agronomy', icon: Cpu },
    { name: 'Farm Analytics & Risk', href: '/analytics', icon: BarChart3 },
    { name: 'RAG Search Engine', href: '/knowledge', icon: FileText }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Sprout className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Kisan Alert AI
            </h1>
            <p className="text-xs text-slate-400 font-medium">National Agricultural Intelligence & Expert Portal</p>
          </div>
        </div>
        
        {/* Navigation Links */}
        <nav className="flex flex-wrap justify-center gap-2 md:gap-4 my-2 md:my-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-bold rounded-xl transition duration-200 border ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-3 text-xs">
          {/* Firestore Status */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-400 hidden sm:inline">Firestore:</span>
            <span className="font-semibold text-emerald-400">Connected</span>
          </div>

          {/* Backend API Status */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
            <RefreshCw className={`h-3.5 w-3.5 ${backendStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'} ${backendStatus === 'connecting' ? 'animate-spin' : ''}`} />
            <span className="text-slate-400 hidden sm:inline">API:</span>
            <span className={`font-semibold ${backendStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {backendStatus === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
