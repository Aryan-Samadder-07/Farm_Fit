'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import {
  Bell, BellOff, CheckCheck, RefreshCw, AlertTriangle, AlertCircle,
  Info, Zap, Cloud, ShieldAlert, Mail, Send, CheckCircle, X
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'INFO';
  created_at: string;
  delivered: boolean;
  email_sent?: boolean;
  ticket_id?: string;
  email?: string;
}

const typeConfig: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  OUTBREAK_WARNING:          { icon: ShieldAlert,   color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100' },
  EXPERT_OUTBREAK_REGISTERED:{ icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  WEATHER_ALERT:             { icon: Cloud,         color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100' },
  DRY_SPELL:                 { icon: Zap,           color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  SYSTEM:                    { icon: Info,          color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

const ALERT_TYPES = [
  { value: 'OUTBREAK_WARNING',           label: '🚨 Outbreak Warning' },
  { value: 'EXPERT_OUTBREAK_REGISTERED', label: '⚠️ Expert-Confirmed Outbreak' },
  { value: 'WEATHER_ALERT',             label: '🌩️ Weather Alert' },
  { value: 'DRY_SPELL',                 label: '☀️ Dry Spell Warning' },
  { value: 'SYSTEM',                    label: 'ℹ️ System Notice' },
];

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
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // ── Test email panel state ────────────────────────────────────────────────
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [testAlertType, setTestAlertType] = useState(ALERT_TYPES[0].value);
  const [testTitle, setTestTitle] = useState('Test Alert from Farm Fit Dashboard');
  const [testMessage, setTestMessage] = useState('This is a test notification email sent from the RSK Dashboard to verify the Gmail SMTP configuration.');
  const [testLocation, setTestLocation] = useState('Nellore District, Andhra Pradesh');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const email = user?.email;
      let url = `${API_BASE_URL}/api/v1/notifications?unread_only=${showUnreadOnly}&limit=50`;
      if (email) {
        url += `&email=${encodeURIComponent(email)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread || 0);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setIsLoading(false);
    }
  }, [showUnreadOnly, user]);

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

  // ── Send test email alert ─────────────────────────────────────────────────
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingEmail(true);
    setEmailResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/send-test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_type: testAlertType,
          title: testTitle,
          message: testMessage,
          location: testLocation,
          severity: testAlertType.includes('OUTBREAK') || testAlertType === 'DRY_SPELL' ? 'CRITICAL' : 'HIGH',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult({ success: true, message: data.message || 'Test email sent successfully!' });
      } else {
        setEmailResult({ success: false, message: data.detail || 'Failed to send test email.' });
      }
    } catch (err: any) {
      setEmailResult({ success: false, message: err.message || 'Network error.' });
    } finally {
      setIsSendingEmail(false);
    }
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

            {/* Test Email button */}
            <button
              id="test-email-btn"
              onClick={() => { setShowEmailPanel(v => !v); setEmailResult(null); }}
              className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition cursor-pointer shadow-sm ${
                showEmailPanel
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              <Mail className="h-3.5 w-3.5" />
              Test Email Alert
            </button>
          </div>
        </div>

        {/* ── Gmail SMTP Test Panel ─────────────────────────────────────────── */}
        {showEmailPanel && (
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-6 space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 border border-indigo-200 p-2 rounded-xl">
                  <Mail className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-indigo-900">Gmail SMTP Alert Test</h3>
                  <p className="text-xs text-indigo-600">Send a test notification email via your configured Gmail account</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailPanel(false)}
                className="p-1.5 bg-white border border-indigo-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* SMTP status */}
            <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-4 py-2.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span className="font-semibold text-slate-700">Gmail SMTP configured</span>
              <span className="text-slate-400 ml-1">— rythusevakendra@gmail.com (port 465 SSL)</span>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Alert Type</label>
                  <select
                    value={testAlertType}
                    onChange={e => setTestAlertType(e.target.value)}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 transition cursor-pointer"
                  >
                    {ALERT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Location</label>
                  <input
                    type="text"
                    value={testLocation}
                    onChange={e => setTestLocation(e.target.value)}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Alert Title</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={e => setTestTitle(e.target.value)}
                  required
                  className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Alert Message</label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  required
                  className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 transition resize-none"
                />
              </div>

              {emailResult && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold border ${
                  emailResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  {emailResult.success
                    ? <CheckCircle className="h-4 w-4 shrink-0" />
                    : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {emailResult.message}
                </div>
              )}

              <button
                type="submit"
                id="send-test-email-btn"
                disabled={isSendingEmail}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition cursor-pointer disabled:opacity-50 text-xs uppercase tracking-wider shadow-sm"
              >
                {isSendingEmail ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Test Alert Email</>
                )}
              </button>
            </form>
          </div>
        )}

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
                  onClick={async () => {
                    if (!n.delivered) {
                      await markRead(n.id);
                    }
                    setSelectedNotification(n);
                  }}
                  className={`relative flex gap-4 p-4 rounded-2xl border transition group bg-white border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50/50 ${
                    n.delivered ? 'opacity-60' : ''
                  }`}>

                  {/* Unread dot */}
                  {!n.delivered && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-xs" />
                  )}

                  <div className={`shrink-0 p-2 rounded-xl border ${cfg.bg} ${cfg.border} h-fit`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>

                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        {n.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                      {/* Email sent badge */}
                      {n.email_sent && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-50 border-indigo-200 text-indigo-600">
                          <Mail className="h-2.5 w-2.5" /> Email Sent
                        </span>
                      )}
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
        {/* Notification Detail Modal popup */}
        {selectedNotification && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-8 shadow-xl space-y-6 transform scale-100 transition duration-300">
              <div className="flex items-start justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                  typeConfig[selectedNotification.type]?.bg || 'bg-slate-50'
                } ${
                  typeConfig[selectedNotification.type]?.border || 'border-slate-100'
                } ${
                  typeConfig[selectedNotification.type]?.color || 'text-slate-600'
                }`}>
                  {selectedNotification.type.replace(/_/g, ' ')}
                </span>
                <button 
                  onClick={() => setSelectedNotification(null)}
                  className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-800 leading-snug">
                  {selectedNotification.title}
                </h3>
                <p className="text-xs text-slate-400">
                  {timeAgo(selectedNotification.created_at)}
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-sm sm:text-base text-slate-700 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-line font-medium">
                {selectedNotification.message}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                {(() => {
                  const match = selectedNotification.message.match(/\/review\/([a-zA-Z0-9_]+)/);
                  const tId = selectedNotification.ticket_id || (match ? match[1] : null);
                  if (tId) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedNotification(null);
                          router.push(`/review/${tId}`);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-sm"
                      >
                        View Ticket Details
                      </button>
                    );
                  }
                  return null;
                })()}
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                >
                  Close Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
