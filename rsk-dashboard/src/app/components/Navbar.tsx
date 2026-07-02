'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Sprout, Sparkles, Database, RefreshCw, FileText, BarChart3, Cpu, Map, Bell, ShieldCheck, LogOut, User } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [unreadCount, setUnreadCount] = useState(0);

  // Check API health
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(API_BASE_URL + '/');
        setBackendStatus(res.ok ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => clearInterval(interval);
  }, []);

  // Poll unread notification count every 60s (only for professionals)
  useEffect(() => {
    if (!user || user.role !== 'PROFESSIONAL') return;
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/notifications?unread_only=true&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread || 0);
        }
      } catch { /* silent */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const allItems = [
    { name: 'RSK Expert Portal',    href: '/',              icon: Sprout },
    { name: 'AI Disease Ingestion', href: '/diagnose',      icon: Sparkles },
    { name: 'Soil Advisory',        href: '/agronomy',      icon: Cpu },
    { name: 'Farm Analytics',       href: '/analytics',     icon: BarChart3 },
    { name: 'Analytics Logging',    href: '/analytics/logging', icon: Database },
    { name: 'RAG Search',           href: '/knowledge',     icon: FileText },
    { name: 'GIS Disease Map',      href: '/gis',           icon: Map },
    { name: 'Admin Dashboard',      href: '/admin',         icon: ShieldCheck },
  ];

  const navItems = allItems.filter(item => {
    if (!user) return false;
    const designation = user.designation?.toUpperCase() || '';
    
    if (designation === 'ADMIN') return true;
    
    if (user.role === 'FARMER') {
      const allowed = ['/diagnose', '/agronomy', '/knowledge', '/gis'];
      return allowed.includes(item.href);
    }
    
    if (designation === 'VILLAGE CHIEF') {
      const allowed = ['/analytics', '/analytics/logging', '/gis'];
      return allowed.includes(item.href);
    }
    
    if (designation === 'RSK EXPERT') {
      const allowed = ['/', '/gis', '/analytics', '/knowledge'];
      return allowed.includes(item.href);
    }
    
    if (designation === 'MANDI HEAD') {
      const allowed = ['/analytics', '/gis'];
      return allowed.includes(item.href);
    }
    
    return false;
  });

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">

        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent leading-tight">
              Kisan Alert AI
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">National Agricultural Intelligence Platform</p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-wrap justify-center gap-1 my-1 md:my-0">
          {navItems.map(({ name, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition duration-200 border ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40'
                }`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right-side status + notification bell + User Profile */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          
          {/* User badge */}
          {user && (
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-900 px-3 py-1.5 rounded-xl text-[11px]">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <div className="flex flex-col items-start leading-none">
                <span className="font-bold text-slate-200">{user.name}</span>
                <span className={`text-[8px] font-black uppercase mt-0.5 ${
                  user.role === 'FARMER' ? 'text-emerald-400' : 'text-violet-400'
                }`}>
                  {user.role === 'FARMER' ? `Farmer (${user.village_name})` : user.designation}
                </span>
              </div>
            </div>
          )}

          {/* Notification Bell (Professionals only) */}
          {user && user.role === 'PROFESSIONAL' && (
            <Link href="/notifications"
              className={`relative flex items-center gap-1.5 border px-2.5 py-1.5 rounded-xl transition cursor-pointer ${
                pathname === '/notifications'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}>
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* API Status */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl">
            <RefreshCw className={`h-3 w-3 ${backendStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'} ${backendStatus === 'connecting' ? 'animate-spin' : ''}`} />
            <span className="text-slate-400 hidden sm:inline">API:</span>
            <span className={`font-semibold ${backendStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {backendStatus === 'online' ? 'Online' : backendStatus === 'connecting' ? '…' : 'Offline'}
            </span>
          </div>

          {/* Logout button */}
          {user && (
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1 bg-slate-900 hover:bg-rose-950/20 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 px-2.5 py-1.5 rounded-xl transition cursor-pointer font-bold text-slate-400"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Logout</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
}
