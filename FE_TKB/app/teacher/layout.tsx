'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { LayoutDashboard, CalendarDays, Clock, KeyRound, LogOut, PanelLeftClose, PanelLeft, Bell, Check } from 'lucide-react';
import AppLogo from '../components/AppLogo';
import ThemeToggle from '../components/ThemeToggle';
import { API_URL } from '@/lib/api';

const teacherMenuItems = [
  { name: 'Tổng quan', href: '/teacher', icon: LayoutDashboard },
  { name: 'Thời khóa biểu', href: '/teacher/schedule', icon: CalendarDays },
  { name: 'Đăng ký bận', href: '/teacher/feedback', icon: Clock },
  { name: 'Đổi mật khẩu', href: '/teacher/profile', icon: KeyRound },
];

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function TeacherSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 z-30 md:hidden ${collapsed ? 'hidden' : 'block'}`}
        onClick={() => setCollapsed(true)} />

      <div className={`${collapsed ? 'w-[68px]' : 'w-64'} h-full bg-[var(--bg-sidebar)] text-white flex flex-col shadow-xl transition-all duration-200 z-40
        fixed md:relative`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-4 border-b border-white/10`}>
          {!collapsed && <AppLogo size="sm" />}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-sidebar)] transition-colors">
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {teacherMenuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
                  ${isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-medium'
                    : 'text-[var(--text-sidebar)] hover:bg-white/8 hover:text-white'}
                  ${collapsed ? 'justify-center' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                {!collapsed && <span className="text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-white/10">
          <button onClick={onLogout} title={collapsed ? 'Đăng xuất' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
              text-red-400 hover:bg-red-500/15 hover:text-red-300 ${collapsed ? 'justify-center' : ''}`}>
            <LogOut size={20} strokeWidth={1.8} />
            {!collapsed && <span className="text-sm">Đăng xuất</span>}
          </button>
        </div>
      </div>
    </>
  );
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (!token || !savedUser) { router.push('/'); return; }
    const userData = JSON.parse(savedUser);
    if (userData.role !== 'TEACHER') { router.push('/'); return; }
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
      if (countRes.ok) { const d = await countRes.json(); setUnreadCount(d.count); }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
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
      await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) { console.error(e); }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-base)] overflow-hidden transition-colors">
      <TeacherSidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-default)]
          flex items-center justify-between px-4 md:px-6 z-20 transition-colors">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            Xin chào, <span className="text-[var(--text-primary)] font-semibold">
              {user.full_name || user.ho_ten || user.username}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifications(v => !v); if (!showNotifications) fetchNotifications(); }}
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
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--border-default)]
                  bg-[var(--bg-surface)] shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">Thông báo</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-medium">
                        <Check size={12} /> Đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
                        <p className="text-sm text-[var(--text-muted)]">Chưa có thông báo nào</p>
                      </div>
                    ) : notifications.map(notif => (
                      <div key={notif.id}
                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                        className={`px-4 py-3 flex gap-3 border-b border-[var(--border-light)] cursor-pointer
                          hover:bg-[var(--bg-surface-hover)] transition-colors
                          ${!notif.is_read ? 'bg-blue-500/5' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-semibold truncate ${!notif.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                              {notif.title}
                            </p>
                            {!notif.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-1 opacity-60">{timeAgo(notif.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600
              flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {user.username[0].toUpperCase()}
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
