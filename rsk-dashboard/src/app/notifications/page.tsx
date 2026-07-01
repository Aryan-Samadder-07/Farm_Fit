'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { Bell, BellOff, CheckCheck, RefreshCw, AlertTriangle, AlertCircle, Info, Zap, Cloud, ShieldAlert } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'INFO';
  created_at: string;
  delivered: boolean;
}

const typeConfig: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  OUTBREAK_WARNING:          { icon: ShieldAlert,   color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20' },
  EXPERT_OUTBREAK_REGISTERED:{ icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  WEATHER_ALERT:             { icon: Cloud,         color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20' },
  SYSTEM:                    { icon: Info,          color: 'text-slate-400',  bg: 'bg-slate-800/40',  border: 'border-slate-700' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications?unread_only=${showUnreadOnly}&limit=50`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread || 0);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setIsLoading(false);
    }
  }, [showUnreadOnly]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    if (id.startsWith('demo_')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, delivered: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
      return;
    }
    try {
      await fetch(`${API_BASE_URL}/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, delivered: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await fetch(`${API_BASE_URL}/api/v1/notifications/mark-all-read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, delivered: true })));
      setUnreadCount(0);
    } catch (err) { console.error(err); }
    finally { setIsMarkingAll(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-grow">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative bg-slate-800 border border-slate-700 p-2.5 rounded-xl text-slate-300">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black">System Alert Inbox</h2>
              <p className="text-xs text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowUnreadOnly(v => !v)}
              className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition cursor-pointer ${
                showUnreadOnly ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}>
              <BellOff className="h-3.5 w-3.5" />
              {showUnreadOnly ? 'Show All' : 'Unread Only'}
            </button>

            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={isMarkingAll}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 transition cursor-pointer disabled:opacity-50">
                {isMarkingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                Mark All Read
              </button>
            )}

            <button onClick={fetchNotifications} disabled={isLoading}
              className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 transition cursor-pointer">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-emerald-500/40" />
            Loading notifications…
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-24 text-center bg-slate-900/10 border border-slate-800/40 rounded-3xl">
            <Bell className="h-10 w-10 text-slate-700 mx-auto stroke-1 mb-3" />
            <h3 className="text-base font-bold text-slate-400">No alerts</h3>
            <p className="text-xs text-slate-500 mt-1">System alerts will appear here as they arrive.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => {
              const cfg = typeConfig[n.type] || typeConfig['SYSTEM'];
              const Icon = cfg.icon;
              return (
                <div key={n.id}
                  onClick={() => !n.delivered && markRead(n.id)}
                  className={`relative flex gap-4 p-4 rounded-2xl border transition group ${cfg.bg} ${cfg.border} ${
                    !n.delivered ? 'cursor-pointer hover:brightness-110' : 'opacity-60'
                  }`}>

                  {/* Unread dot */}
                  {!n.delivered && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                  )}

                  <div className={`shrink-0 p-2 rounded-xl border ${cfg.bg} ${cfg.border} h-fit`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        {n.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500">{timeAgo(n.created_at)}</span>
                    </div>
                    <h4 className={`text-sm font-bold ${n.delivered ? 'text-slate-400' : 'text-slate-100'}`}>{n.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{n.message}</p>
                    {!n.delivered && (
                      <p className="text-[10px] text-slate-600 pt-0.5">Click to mark as read</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
