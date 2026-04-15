'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import AdminSidebar from '../components/admin/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import { Bell, LogOut, User, Settings, Check, FileSpreadsheet, Calendar, MessageSquare, Clock, Monitor } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Notification {
  id: string;
  category: 'IMPORT' | 'TIMETABLE' | 'FEEDBACK' | 'BUSY_SCHEDULE' | 'SYSTEM';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  IMPORT: { icon: FileSpreadsheet, color: 'text-green-500', label: 'Import' },
  TIMETABLE: { icon: Calendar, color: 'text-blue-500', label: 'TKB' },
  FEEDBACK: { icon: MessageSquare, color: 'text-purple-500', label: 'Phản hồi' },
  BUSY_SCHEDULE: { icon: Clock, color: 'text-orange-500', label: 'Lịch bận' },
  SYSTEM: { icon: Monitor, color: 'text-gray-400', label: 'Hệ thống' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (!token || !savedUser) { router.push('/'); return; }
    const userData = JSON.parse(savedUser);
    if (userData.role !== 'ADMIN') { router.push('/'); return; }
    setUser(userData);
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const [notifRes, countRes] = await Promise.all([
        fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (notifRes.ok) setNotifications(await notifRes.json());
      if (countRes.ok) {
        const data = await countRes.json();
        setUnreadCount(data.count);
      }
    } catch (e) { console.error(e); }
  }, []);

  // Poll notifications every 30s
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) { console.error(e); }
  };

  const filteredNotifications = activeCategory
    ? notifications.filter(n => n.category === activeCategory)
    : notifications;

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-base)] overflow-hidden transition-colors">
      <AdminSidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-default)]
          flex items-center justify-between px-4 md:px-6 z-20 transition-colors">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            Xin chào, <span className="text-[var(--text-primary)] font-semibold">{user.username}</span>
          </h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); if (!showNotifications) fetchNotifications(); }}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center
                  bg-[var(--bg-surface-hover)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] transition-colors"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
                    bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-[28rem] rounded-xl border border-[var(--border-default)]
                  bg-[var(--bg-surface)] shadow-2xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">Thông báo</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-medium">
                        <Check size={12} /> Đọc tất cả
                      </button>
                    )}
                  </div>

                  {/* Category Tabs */}
                  <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-[var(--border-default)]">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors
                        ${!activeCategory ? 'bg-blue-500 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]'}`}
                    >
                      Tất cả
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setActiveCategory(activeCategory === key ? null : key)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors
                          ${activeCategory === key ? 'bg-blue-500 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]'}`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto">
                    {filteredNotifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
                        <p className="text-sm text-[var(--text-muted)]">Chưa có thông báo nào</p>
                      </div>
                    ) : (
                      filteredNotifications.map((notif) => {
                        const cfg = CATEGORY_CONFIG[notif.category] ?? CATEGORY_CONFIG.SYSTEM;
                        const Icon = cfg.icon;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => !notif.is_read && markAsRead(notif.id)}
                            className={`px-4 py-3 flex gap-3 border-b border-[var(--border-light)] cursor-pointer
                              hover:bg-[var(--bg-surface-hover)] transition-colors
                              ${!notif.is_read ? 'bg-blue-500/5' : ''}`}
                          >
                            <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
                              <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-semibold truncate ${!notif.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {notif.title}
                                </p>
                                {!notif.is_read && (
                                  <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                                )}
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-[var(--text-muted)] mt-1 opacity-60">{timeAgo(notif.created_at)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600
                  flex items-center justify-center text-white text-sm font-bold shadow-sm
                  hover:from-blue-600 hover:to-violet-700 transition-all cursor-pointer"
              >
                {user.username[0].toUpperCase()}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border-default)]
                  bg-[var(--bg-surface)] shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border-default)]">
                    <p className="font-bold text-sm text-[var(--text-primary)]">{user.username}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Giáo viên'}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setShowProfileMenu(false); router.push('/admin/accounts'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)]
                        hover:bg-[var(--bg-surface-hover)] transition-colors text-left"
                    >
                      <User size={16} />
                      Quản lý tài khoản
                    </button>
                    <button
                      onClick={() => { setShowProfileMenu(false); router.push('/admin/configuration'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)]
                        hover:bg-[var(--bg-surface-hover)] transition-colors text-left"
                    >
                      <Settings size={16} />
                      Cấu hình hệ thống
                    </button>
                  </div>
                  <div className="border-t border-[var(--border-default)] py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500
                        hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut size={16} />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
