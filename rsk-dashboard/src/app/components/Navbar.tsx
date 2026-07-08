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

  // Poll unread notification count every 60s (for all logged-in users, targeted by phone)
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        let url = `${API_BASE_URL}/api/v1/notifications?unread_only=true&limit=50`;
        const email = user.email;
        if (email) {
          url += `&email=${encodeURIComponent(email)}`;
        }
        const res = await fetch(url);
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">

        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
            <Sprout className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Kisan Alert AI
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase hidden sm:block">National Agricultural Intelligence Platform</p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-wrap justify-center gap-0.5 my-1 md:my-0">
          {navItems.map(({ name, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition duration-150 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right-side: status + notification bell + User Profile */}
        <div className="flex items-center gap-2 text-xs shrink-0">

          {/* User badge */}
          {user && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-[11px]">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <div className="flex flex-col items-start leading-none">
                <span className="font-bold text-slate-800">{user.name}</span>
                <span className={`text-[8px] font-bold uppercase mt-0.5 ${
                  user.role === 'FARMER' ? 'text-emerald-600' : 'text-indigo-600'
                }`}>
                  {user.role === 'FARMER' ? `Farmer · ${user.village_name}` : user.designation}
                </span>
              </div>
            </div>
          )}

          {/* Notification Bell (All logged-in users) */}
          {user && (
            <Link href="/notifications"
              className={`relative flex items-center gap-1.5 border px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                pathname === '/notifications'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* API Status */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">
            <RefreshCw className={`h-3 w-3 ${backendStatus === 'online' ? 'text-emerald-500' : 'text-rose-500'} ${backendStatus === 'connecting' ? 'animate-spin' : ''}`} />
            <span className="text-slate-400 hidden sm:inline">API:</span>
            <span className={`font-semibold ${backendStatus === 'online' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {backendStatus === 'online' ? 'Online' : backendStatus === 'connecting' ? '…' : 'Offline'}
            </span>
          </div>

          {/* Logout button */}
          {user && (
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1 bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-semibold text-slate-500"
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
