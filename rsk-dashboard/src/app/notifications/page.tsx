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
  OUTBREAK_WARNING:          { icon: ShieldAlert,   color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100' },
  EXPERT_OUTBREAK_REGISTERED:{ icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  WEATHER_ALERT:             { icon: Cloud,         color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100' },
  SYSTEM:                    { icon: Info,          color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-grow">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative bg-white border border-slate-200 p-2.5 rounded-xl text-slate-600 shadow-sm animate-fade-in">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">System Alert Inbox</h2>
              <p className="text-xs text-slate-500 font-medium">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowUnreadOnly(v => !v)}
              className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition cursor-pointer shadow-sm ${
                showUnreadOnly ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              <BellOff className="h-3.5 w-3.5" />
              {showUnreadOnly ? 'Show All' : 'Unread Only'}
            </button>

            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={isMarkingAll}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border bg-white border-slate-200 text-slate-600 hover:border-slate-300 transition cursor-pointer disabled:opacity-50 shadow-sm">
                {isMarkingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                Mark All Read
              </button>
            )}

            <button onClick={fetchNotifications} disabled={isLoading}
              className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border bg-white border-slate-200 text-slate-600 hover:border-slate-300 transition cursor-pointer shadow-sm">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-300" />
            Loading notifications…
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-24 text-center bg-white border border-slate-200 rounded-3xl shadow-sm">
            <Bell className="h-10 w-10 text-slate-400 mx-auto stroke-1 mb-3" />
            <h3 className="text-base font-bold text-slate-550">No alerts</h3>
            <p className="text-xs text-slate-400 mt-1">System alerts will appear here as they arrive.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => {
              const cfg = typeConfig[n.type] || typeConfig['SYSTEM'];
              const Icon = cfg.icon;
              return (
                <div key={n.id}
                  onClick={() => !n.delivered && markRead(n.id)}
                  className={`relative flex gap-4 p-4 rounded-2xl border transition group bg-white border-slate-200 shadow-sm ${
                    !n.delivered ? 'cursor-pointer hover:bg-slate-50/50' : 'opacity-60'
                  }`}>

                  {/* Unread dot */}
                  {!n.delivered && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-xs" />
                  )}

                  <div className={`shrink-0 p-2 rounded-xl border ${cfg.bg} ${cfg.border} h-fit`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        {n.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                    </div>
                    <h4 className={`text-sm font-bold ${n.delivered ? 'text-slate-400' : 'text-slate-800'}`}>{n.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                    {!n.delivered && (
                      <p className="text-[10px] text-slate-400 pt-0.5">Click to mark as read</p>
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
